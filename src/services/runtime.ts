import type { AdapterSet } from './contracts';
import { createMemoryAuthService, type AuthService, type AuthUser } from './authService';
import { createMemoryAdapters, createMemoryDatabase, type MemoryDatabase } from './memoryAdapter';
import { createAdapterExecutor, createMemoryQueueStore, QueuedWriter, type QueueStore, type Scheduler } from './queuedWriter';
import { createServices, type StudioServices } from './services';
import { createMemoryStorageAdapter, StorageService, type StorageAdapter } from './storageService';

export interface StudioRuntime {
  auth: AuthService;
  writer: QueuedWriter;
  services: StudioServices;
  storage: StorageService;
  currentUserId(): string | null;
  setCurrentUser(user: AuthUser | null): void;
}

export interface RuntimeOptions {
  auth: AuthService;
  adapters: AdapterSet;
  store: QueueStore;
  storage: StorageAdapter;
  schedule?: Scheduler;
  listenOnline?: boolean;
}

export function createStudioRuntime({ auth, adapters, store, storage, schedule, listenOnline }: RuntimeOptions): StudioRuntime {
  let userId: string | null = null;
  const writer = new QueuedWriter({ store, execute: createAdapterExecutor(adapters), schedule, listenOnline });
  const services = createServices({ adapters, writer, getUserId: () => userId });
  return {
    auth, writer, services, storage: new StorageService(storage),
    currentUserId: () => userId, setCurrentUser: (user) => { userId = user?.id ?? null; },
  };
}

export function createMemoryRuntime(options: { db?: MemoryDatabase; user?: AuthUser | null; store?: QueueStore } = {}) {
  const db = options.db ?? createMemoryDatabase();
  const auth = createMemoryAuthService(db, options.user ?? null);
  let runtime: StudioRuntime;
  const adapters = createMemoryAdapters(db, () => runtime.currentUserId());
  const storage = createMemoryStorageAdapter(db, () => runtime.currentUserId());
  runtime = createStudioRuntime({ auth, adapters, store: options.store ?? createMemoryQueueStore(), storage });
  if (options.user) runtime.setCurrentUser(options.user);
  return { ...runtime, db, memoryAuth: auth, memoryStorage: storage };
}
