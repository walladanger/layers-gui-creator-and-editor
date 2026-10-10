import { ServiceError, type AdapterSet, type RecordAdapter } from './contracts';
import { tableNames, type Rows, type TableName } from './types';

interface PostgrestError { code?: string; message: string }
interface Result<T> { data: T | null; error: PostgrestError | null }
// Minimal structural view of the Supabase query builder, so this file never depends on generated types.
interface Query<T> extends PromiseLike<Result<T>> {
  select(columns?: string): Query<T>;
  insert(row: unknown): Query<T>;
  update(patch: unknown): Query<T>;
  delete(): Query<T>;
  eq(column: string, value: unknown): Query<T>;
  order(column: string, options?: { ascending?: boolean }): Query<T>;
  single(): Query<T>;
  maybeSingle(): Query<T>;
}
export interface SupabaseLikeClient { from(table: string): Query<unknown> }

export function toServiceError(error: PostgrestError): ServiceError {
  const code = error.code ?? '';
  if (code === '42501' || /row-level security/i.test(error.message)) return new ServiceError('rls-denied', error.message);
  if (code === 'PGRST116') return new ServiceError('not-found', error.message);
  if (code.startsWith('22') || code.startsWith('23')) return new ServiceError('invalid', error.message);
  if (/fetch|network|failed to fetch|timeout/i.test(error.message)) return new ServiceError('network', error.message);
  return new ServiceError('unknown', error.message);
}

async function run<T>(query: PromiseLike<Result<unknown>>): Promise<T> {
  let result: Result<unknown>;
  try { result = await query; } catch (error) { throw new ServiceError('network', error instanceof Error ? error.message : String(error)); }
  if (result.error) throw toServiceError(result.error);
  return result.data as T;
}

export function createSupabaseAdapter<K extends TableName>(client: SupabaseLikeClient, table: K): RecordAdapter<Rows[K]> {
  type Row = Rows[K];
  const from = () => client.from(table);
  return {
    async list(filter) {
      let query = from().select('*');
      for (const [key, value] of Object.entries(filter ?? {})) query = query.eq(key, value);
      return run<Row[]>(query.order('created_at', { ascending: true }));
    },
    get: (id) => run<Row | null>(from().select('*').eq('id', id).maybeSingle()),
    insert: (row) => run<Row>(from().insert(row).select('*').single()),
    update: (id, patch) => run<Row>(from().update(patch).eq('id', id).select('*').single()),
    async remove(id) { await run(from().delete().eq('id', id)); },
  };
}

export function createSupabaseAdapters(client: SupabaseLikeClient): AdapterSet {
  return Object.fromEntries(tableNames.map((name) => [name, createSupabaseAdapter(client, name)])) as unknown as AdapterSet;
}
