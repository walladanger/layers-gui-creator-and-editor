import type { BaseRow, Rows, TableName } from './types';

export interface PersistenceAdapter<T> {
  read(): Promise<T | null>;
  write(value: T): Promise<void>;
  clear(): Promise<void>;
}

/** A new row always carries a client-made id, so queued writes can be replayed safely. */
export type NewRow<T extends BaseRow> = Partial<Omit<T, 'created_at' | 'updated_at'>> & { id: string };

/** Per-table adapter, the record-shaped sibling of `PersistenceAdapter`. Supabase and in-memory versions share it. */
export interface RecordAdapter<T extends BaseRow> {
  list(filter?: Partial<T>): Promise<T[]>;
  get(id: string): Promise<T | null>;
  insert(row: NewRow<T>): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T>;
  remove(id: string): Promise<void>;
}

export type AdapterSet = { [K in TableName]: RecordAdapter<Rows[K]> };

export type ServiceErrorCode = 'rls-denied' | 'not-found' | 'invalid' | 'network' | 'unknown';

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  constructor(code: ServiceErrorCode, message: string = code) { super(message); this.code = code; this.name = 'ServiceError'; }
}

/** Errors that will never succeed on retry. Network-ish failures stay retryable. */
export function isPermanentError(error: unknown) {
  return error instanceof ServiceError && (error.code === 'rls-denied' || error.code === 'invalid' || error.code === 'not-found');
}
