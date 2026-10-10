import { isPermanentError, type AdapterSet } from './contracts';
import type { TableName } from './types';

export type QueuedAction = 'insert' | 'update' | 'delete';

export interface QueuedOp {
  id: string;
  seq: number;
  table: TableName;
  action: QueuedAction;
  rowId: string;
  payload?: Record<string, unknown>;
  attempts: number;
  enqueuedAt: number;
  lastError?: string;
  /** Set when the server will never accept this write. Kept (never dropped) so nothing is lost. */
  failed?: boolean;
}

export type QueuedOpInput = Pick<QueuedOp, 'table' | 'action' | 'rowId' | 'payload'>;

/** Durable store for the queue. IndexedDB in the browser, memory in tests. */
export interface QueueStore {
  load(): Promise<QueuedOp[]>;
  put(op: QueuedOp): Promise<void>;
  remove(id: string): Promise<void>;
}

export function createMemoryQueueStore(initial: QueuedOp[] = []): QueueStore & { ops(): QueuedOp[] } {
  const ops = new Map(initial.map((op) => [op.id, structuredClone(op)]));
  return {
    async load() { return [...ops.values()].map((op) => structuredClone(op)); },
    async put(op) { ops.set(op.id, structuredClone(op)); },
    async remove(id) { ops.delete(id); },
    ops: () => [...ops.values()].sort((a, b) => a.seq - b.seq),
  };
}

const DB_NAME = 'radium-studio';
const STORE = 'write-queue';

function request<T>(req: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
}

export function createIndexedDbQueueStore(factory: IDBFactory | undefined = typeof indexedDB === 'undefined' ? undefined : indexedDB): QueueStore {
  if (!factory) return createMemoryQueueStore();
  let dbPromise: Promise<IDBDatabase> | null = null;
  const open = () => {
    dbPromise ??= new Promise((resolve, reject) => {
      const req = factory.open(DB_NAME, 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  };
  const tx = async (mode: IDBTransactionMode) => (await open()).transaction(STORE, mode).objectStore(STORE);
  return {
    async load() { return (await request((await tx('readonly')).getAll() as IDBRequest<QueuedOp[]>)).sort((a, b) => a.seq - b.seq); },
    async put(op) { await request((await tx('readwrite')).put(op)); },
    async remove(id) { await request((await tx('readwrite')).delete(id)); },
  };
}

export type Scheduler = (run: () => void, delayMs: number) => () => void;

export interface QueuedWriterOptions {
  store: QueueStore;
  execute(op: QueuedOp): Promise<void>;
  isPermanent?(error: unknown): boolean;
  baseDelayMs?: number;
  maxDelayMs?: number;
  schedule?: Scheduler;
  /** Retry immediately when the browser reports it is back online. */
  listenOnline?: boolean;
}

const defaultScheduler: Scheduler = (run, delay) => { const t = setTimeout(run, delay); return () => clearTimeout(t); };

export function backoffDelay(attempts: number, base = 500, max = 30_000) {
  return Math.min(max, base * 2 ** Math.max(0, attempts - 1));
}

/** Ordered write queue (Radium's queued/flushEdits pattern). A failed write stays queued and retries with backoff. */
export class QueuedWriter {
  private pending: QueuedOp[] = [];
  private failedOps: QueuedOp[] = [];
  private nextSeq = 1;
  private running: Promise<void> | null = null;
  private cancelRetry: (() => void) | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly options: Required<Omit<QueuedWriterOptions, 'listenOnline'>>;
  private readonly onOnline = () => { void this.retryNow(); };
  readonly ready: Promise<void>;

  constructor(options: QueuedWriterOptions) {
    this.options = {
      isPermanent: isPermanentError, baseDelayMs: 500, maxDelayMs: 30_000, schedule: defaultScheduler, ...options,
    };
    if (options.listenOnline && typeof window !== 'undefined') window.addEventListener('online', this.onOnline);
    this.ready = this.options.store.load().then((ops) => {
      const sorted = ops.sort((a, b) => a.seq - b.seq);
      this.pending = [...sorted.filter((op) => !op.failed), ...this.pending];
      this.failedOps = sorted.filter((op) => op.failed);
      this.nextSeq = Math.max(this.nextSeq, ...sorted.map((op) => op.seq + 1));
      this.publish();
      if (this.pending.length) this.kick();
    }).catch(() => undefined);
  }

  get pendingCount() { return this.pending.length; }
  get failedCount() { return this.failedOps.length; }
  get failed(): readonly QueuedOp[] { return this.failedOps; }

  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private publish() { this.listeners.forEach((listener) => listener()); }

  async enqueue(input: QueuedOpInput): Promise<QueuedOp> {
    await this.ready;
    const op: QueuedOp = { ...input, id: crypto.randomUUID(), seq: this.nextSeq++, attempts: 0, enqueuedAt: Date.now() };
    this.pending.push(op);
    this.publish();
    await this.options.store.put(op);
    this.kick();
    return op;
  }

  /** Runs the queue until it is empty or a write fails. */
  flush(): Promise<void> {
    this.running ??= this.drain().finally(() => { this.running = null; });
    return this.running;
  }

  retryNow() {
    this.cancelRetry?.();
    this.cancelRetry = null;
    return this.flush();
  }

  dispose() {
    this.cancelRetry?.();
    if (typeof window !== 'undefined') window.removeEventListener('online', this.onOnline);
    this.listeners.clear();
  }

  private kick() { if (!this.cancelRetry) void this.flush(); }

  private async drain() {
    await this.ready;
    while (this.pending.length) {
      const op = this.pending[0];
      try {
        await this.options.execute(op);
        this.pending.shift();
        await this.options.store.remove(op.id);
        this.publish();
      } catch (error) {
        op.attempts += 1;
        op.lastError = error instanceof Error ? error.message : String(error);
        if (this.options.isPermanent(error)) {
          op.failed = true;
          this.pending.shift();
          this.failedOps.push(op);
          await this.options.store.put(op);
          this.publish();
          continue;
        }
        await this.options.store.put(op);
        this.publish();
        const delay = backoffDelay(op.attempts, this.options.baseDelayMs, this.options.maxDelayMs);
        this.cancelRetry?.();
        this.cancelRetry = this.options.schedule(() => { this.cancelRetry = null; void this.flush(); }, delay);
        return;
      }
    }
  }
}

/** Replays a queued op against a set of record adapters (Supabase or in-memory). */
export function createAdapterExecutor(adapters: AdapterSet) {
  return async (op: QueuedOp) => {
    const adapter = adapters[op.table] as AdapterSet['projects'];
    if (op.action === 'insert') {
      const existing = await adapter.get(op.rowId);
      if (!existing) await adapter.insert({ ...(op.payload ?? {}), id: op.rowId } as never);
    } else if (op.action === 'update') {
      await adapter.update(op.rowId, (op.payload ?? {}) as never);
    } else {
      await adapter.remove(op.rowId);
    }
  };
}
