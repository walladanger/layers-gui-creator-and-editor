import type { AdapterSet } from './contracts';
import { createMemoryAuthService, type AuthService, type AuthUser } from './authService';
import { createMemoryAdapters, createMemoryDatabase, type MemoryDatabase } from './memoryAdapter';
import { createAdapterExecutor, createMemoryQueueStore, QueuedWriter, type QueueStore, type Scheduler } from './queuedWriter';
import { createServices, type StudioServices } from './services';

export interface StudioRuntime {
  auth: AuthService;
  writer: QueuedWriter;
  services: StudioServices;
  currentUserId(): string | null;
  setCurrentUser(user: AuthUser | null): void;
}

export interface RuntimeOptions {
  auth: AuthService;
  adapters: AdapterSet;
  store: QueueStore;
  schedule?: Scheduler;
  listenOnline?: boolean;
}

export function createStudioRuntime({ auth, adapters, store, schedule, listenOnline }: RuntimeOptions): StudioRuntime {
  let userId: string | null = null;
  const writer = new QueuedWriter({ store, execute: createAdapterExecutor(adapters), schedule, listenOnline });
  const services = createServices({ adapters, writer, getUserId: () => userId });
  return { auth, writer, services, currentUserId: () => userId, setCurrentUser: (user) => { userId = user?.id ?? null; } };
}

export function createMemoryRuntime(options: { db?: MemoryDatabase; user?: AuthUser | null; store?: QueueStore } = {}) {
  const db = options.db ?? createMemoryDatabase();
  const auth = createMemoryAuthService(db, options.user ?? null);
  let runtime: StudioRuntime;
  const adapters = createMemoryAdapters(db, () => runtime.currentUserId());
  runtime = createStudioRuntime({ auth, adapters, store: options.store ?? createMemoryQueueStore() });
  if (options.user) runtime.setCurrentUser(options.user);
  return { ...runtime, db, memoryAuth: auth };
}
