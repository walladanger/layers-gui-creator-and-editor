import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { ServiceError } from './contracts';
import { createMemoryAdapters, createMemoryDatabase } from './memoryAdapter';
import {
  backoffDelay, createAdapterExecutor, createIndexedDbQueueStore, createMemoryQueueStore, QueuedWriter, type QueuedOp, type Scheduler,
} from './queuedWriter';
import { createServices } from './services';

function manualScheduler() {
  const timers: { run: () => void; delay: number }[] = [];
  const schedule: Scheduler = (run, delay) => { const t = { run, delay }; timers.push(t); return () => { timers.splice(timers.indexOf(t), 1); }; };
  return { schedule, timers, fire: () => { const t = timers.shift(); t?.run(); return t?.delay; } };
}

test('Review Focus 5: edits keep working offline, show as unsynced, and replay in order on reconnect', async () => {
  const db = createMemoryDatabase();
  const adapters = createMemoryAdapters(db, () => 'user-a');
  let online = true;
  const applied: string[] = [];
  const execute = createAdapterExecutor(adapters);
  const clock = manualScheduler();
  const writer = new QueuedWriter({
    store: createMemoryQueueStore(),
    schedule: clock.schedule,
    execute: async (op) => {
      if (!online) throw new ServiceError('network', 'Failed to fetch');
      await execute(op);
      applied.push(`${op.action}:${op.table}:${String(op.payload?.name ?? op.payload?.text ?? '')}`);
    },
  });
  const services = createServices({ adapters, writer, getUserId: () => 'user-a' });

  const project = await services.projects.create({ name: 'Radium', target_mode: 'demo' });
  await writer.flush();
  expect(writer.pendingCount).toBe(0);

  online = false; // Lovable Cloud goes away mid-session
  const session = await services.sessions.create(project.id, 'Runtimes polish');
  await services.comments.add({ project_id: project.id, session_id: session.id, text: 'first' });
  await services.projects.rename(project.id, 'Radium v2');
  await services.comments.add({ project_id: project.id, text: 'second' });
  await writer.flush();

  expect(writer.pendingCount).toBe(4);
  expect(db.sessions.size).toBe(0);
  expect(clock.timers).toHaveLength(1); // one retry scheduled, nothing lost

  clock.fire(); // still offline: backs off again
  await writer.flush();
  expect(writer.pendingCount).toBe(4);

  online = true;
  await writer.retryNow();

  expect(writer.pendingCount).toBe(0);
  expect(applied).toEqual([
    'insert:projects:Radium',
    'insert:sessions:Runtimes polish',
    'insert:comments:first',
    'update:projects:Radium v2',
    'insert:comments:second',
  ]);
  expect(db.projects.get(project.id)?.name).toBe('Radium v2');
  expect([...db.comments.values()].map((c) => c.text)).toEqual(['first', 'second']);
});

test('retries back off exponentially up to a cap', () => {
  expect([1, 2, 3, 4].map((n) => backoffDelay(n, 500, 30_000))).toEqual([500, 1000, 2000, 4000]);
  expect(backoffDelay(20, 500, 30_000)).toBe(30_000);
});

test('pendingCount notifies subscribers', async () => {
  const writer = new QueuedWriter({ store: createMemoryQueueStore(), schedule: manualScheduler().schedule, execute: async () => { throw new Error('offline'); } });
  const counts: number[] = [];
  writer.subscribe(() => counts.push(writer.pendingCount));
  await writer.enqueue({ table: 'projects', action: 'delete', rowId: 'x' });
  await writer.flush();
  expect(writer.pendingCount).toBe(1);
  expect(counts).toContain(1);
});

test('a write the server rejects for good is kept aside and does not block later writes', async () => {
  const done: string[] = [];
  const writer = new QueuedWriter({
    store: createMemoryQueueStore(),
    schedule: manualScheduler().schedule,
    execute: async (op) => { if (op.rowId === 'bad') throw new ServiceError('rls-denied'); done.push(op.rowId); },
  });
  await writer.enqueue({ table: 'projects', action: 'delete', rowId: 'bad' });
  await writer.enqueue({ table: 'projects', action: 'delete', rowId: 'good' });
  await writer.flush();
  expect(done).toEqual(['good']);
  expect(writer.pendingCount).toBe(0);
  expect(writer.failed.map((op) => op.rowId)).toEqual(['bad']);
});

test('the queue is persisted to IndexedDB and survives a reload in order', async () => {
  const factory = new IDBFactory();
  const offline = new QueuedWriter({ store: createIndexedDbQueueStore(factory), schedule: manualScheduler().schedule, execute: async () => { throw new Error('offline'); } });
  await offline.enqueue({ table: 'projects', action: 'delete', rowId: 'one' });
  await offline.enqueue({ table: 'projects', action: 'delete', rowId: 'two' });
  await offline.flush();
  offline.dispose();

  const replayed: QueuedOp[] = [];
  const reloaded = new QueuedWriter({ store: createIndexedDbQueueStore(factory), schedule: manualScheduler().schedule, execute: async (op) => { replayed.push(op); } });
  await reloaded.ready;
  await reloaded.flush();
  expect(replayed.map((op) => op.rowId)).toEqual(['one', 'two']);
  expect(reloaded.pendingCount).toBe(0);
  expect(await createIndexedDbQueueStore(factory).load()).toEqual([]);
});

test('replaying an insert that already reached the server does not duplicate it', async () => {
  const db = createMemoryDatabase();
  const adapters = createMemoryAdapters(db, () => 'u');
  const execute = createAdapterExecutor(adapters);
  const op: QueuedOp = { id: 'q', seq: 1, table: 'projects', action: 'insert', rowId: 'p1', payload: { name: 'A', owner_id: 'u' }, attempts: 0, enqueuedAt: 0 };
  await execute(op);
  await execute(op);
  expect(db.projects.size).toBe(1);
});
