import { ServiceError } from './contracts';
import type { MemoryDatabase } from './memoryAdapter';

/**
 * Typed access to the `screenshots` bucket. Components never touch the storage client directly.
 * Paths follow the §5 contract: `{project_id}/{change_record_id}-{before|after}.png`.
 */
export interface StorageAdapter {
  upload(path: string, data: Blob): Promise<void>;
  /** Short-lived signed URL for reading a private file. */
  signedUrl(path: string, expiresInSeconds?: number): Promise<string>;
  remove(path: string): Promise<void>;
}

const BUCKET = 'screenshots';

/** Project id is always the first path segment; anything else is malformed. */
export function projectIdFromPath(path: string): string {
  const segment = path.split('/')[0];
  if (!segment) throw new ServiceError('invalid', 'Storage path must start with the project id.');
  return segment;
}

interface StorageFileApi {
  upload(path: string, data: Blob): Promise<{ error: { message: string } | null }>;
  createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
  remove(paths: string[]): Promise<{ error: { message: string } | null }>;
}
export interface SupabaseStorageLike {
  from(bucket: string): StorageFileApi;
}

export function createSupabaseStorageAdapter(storage: SupabaseStorageLike): StorageAdapter {
  const files = () => storage.from(BUCKET);
  return {
    async upload(path, data) {
      projectIdFromPath(path);
      const { error } = await files().upload(path, data);
      if (error) throw new ServiceError(/row-level security|not authorized|denied/i.test(error.message) ? 'rls-denied' : 'unknown', error.message);
    },
    async signedUrl(path, expiresInSeconds = 3600) {
      const { data, error } = await files().createSignedUrl(path, expiresInSeconds);
      if (error || !data) throw new ServiceError('not-found', error?.message ?? 'No signed URL returned.');
      return data.signedUrl;
    },
    async remove(path) {
      const { error } = await files().remove([path]);
      if (error) throw new ServiceError('unknown', error.message);
    },
  };
}

function roleInProject(db: MemoryDatabase, projectId: string, userId: string | null) {
  if (!userId) return null;
  if (db.projects.get(projectId)?.owner_id === userId) return 'owner';
  for (const member of db.project_members.values()) {
    if (member.project_id === projectId && member.user_id === userId) return member.role;
  }
  return null;
}

/** In-memory storage for tests; mirrors the bucket's member-read / editor-write policies. */
export function createMemoryStorageAdapter(db: MemoryDatabase, getUserId: () => string | null): StorageAdapter & { files(): Map<string, Blob> } {
  const store = new Map<string, Blob>();
  const role = (path: string) => roleInProject(db, projectIdFromPath(path), getUserId());
  return {
    files: () => store,
    async upload(path, data) {
      const r = role(path);
      if (r !== 'owner' && r !== 'editor') throw new ServiceError('rls-denied', 'Only project owners and editors can upload screenshots.');
      store.set(path, data);
    },
    async signedUrl(path) {
      if (!role(path)) throw new ServiceError('rls-denied', 'Only project members can read screenshots.');
      if (!store.has(path)) throw new ServiceError('not-found', `No file at ${path}.`);
      return `memory://screenshots/${path}`;
    },
    async remove(path) {
      const r = role(path);
      if (r !== 'owner' && r !== 'editor') throw new ServiceError('rls-denied', 'Only project owners and editors can delete screenshots.');
      store.delete(path);
    },
  };
}

/** Thin service wrapper so features depend on a typed service, not an adapter. */
export class StorageService {
  constructor(private readonly adapter: StorageAdapter) {}
  upload(path: string, data: Blob) { return this.adapter.upload(path, data); }
  signedUrl(path: string, expiresInSeconds?: number) { return this.adapter.signedUrl(path, expiresInSeconds); }
  remove(path: string) { return this.adapter.remove(path); }
}
