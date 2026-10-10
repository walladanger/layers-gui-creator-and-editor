import { ServiceError, type AdapterSet, type NewRow, type RecordAdapter } from './contracts';
import { DEMO_PROJECT, tableNames, type BaseRow, type Rows, type TableName } from './types';

/** Shared in-memory database. Adapters made from it apply the same access rules as the SQL policies. */
export type MemoryDatabase = { [K in TableName]: Map<string, Rows[K]> };

export function createMemoryDatabase(): MemoryDatabase {
  return Object.fromEntries(tableNames.map((name) => [name, new Map()])) as unknown as MemoryDatabase;
}

const defaults: { [K in TableName]?: Partial<Rows[K]> } = {
  projects: { target_url: null, target_mode: 'live', repo_url: null, framework: null, design_md: null },
  project_members: { role: 'editor' },
  frames: { route: '/', label: null, width: 1440, height: 900, canvas_x: 0, canvas_y: 0, breakpoint: 'desktop' },
  sessions: { status: 'open', parent_session_id: null, base_commit: null },
  change_records: { frame_id: null, target: {}, before: null, after: null, css: null, tailwind_hint: null, screenshot_before: null, screenshot_after: null, superseded_by: null },
  comments: { session_id: null, frame_id: null, target: {}, px: null, py: null, status: 'open', author_kind: 'user' },
  comment_replies: { author_kind: 'user', author_id: null },
  annotations: { comment_id: null, shapes: [], color: null },
  production_lists: { version: 1, markdown: null, json: null, status: 'draft' },
  production_items: { file: null, line: null, component: null, instructions: null, acceptance: [], change_record_ids: [], priority: 'p2', status: 'queued', agent: null, agent_note: null, pr_url: null },
  design_tokens: { source: 'imported' },
  looks: { style: {}, edits: {} },
  agent_tokens: { last_used_at: null, revoked_at: null },
};

type Access = 'read' | 'write';

function projectOf(db: MemoryDatabase, table: TableName, row: Record<string, unknown>): string | null {
  const str = (value: unknown) => (typeof value === 'string' ? value : null);
  switch (table) {
    case 'projects': return str(row.id);
    case 'change_records':
    case 'production_lists': return db.sessions.get(String(row.session_id))?.project_id ?? null;
    case 'comment_replies': return db.comments.get(String(row.comment_id))?.project_id ?? null;
    case 'annotations': return db.frames.get(String(row.frame_id))?.project_id ?? null;
    case 'production_items': {
      const list = db.production_lists.get(String(row.list_id));
      return list ? db.sessions.get(list.session_id)?.project_id ?? null : null;
    }
    default: return str(row.project_id);
  }
}

function roleIn(db: MemoryDatabase, projectId: string | null, userId: string | null) {
  if (!projectId || !userId) return null;
  const project = db.projects.get(projectId);
  if (project?.owner_id === userId) return 'owner';
  for (const member of db.project_members.values()) if (member.project_id === projectId && member.user_id === userId) return member.role;
  return null;
}

/** Mirrors the row-level security policies in the Phase 2 migration. */
function allowed(db: MemoryDatabase, table: TableName, row: Record<string, unknown>, userId: string | null, access: Access) {
  const projectId = projectOf(db, table, row);
  const role = roleIn(db, projectId, userId);
  if (!role) return false;
  if (access === 'read') return table === 'agent_tokens' ? role === 'owner' : true;
  if (table === 'agent_tokens' || table === 'project_members') return role === 'owner';
  if (table === 'comments' || table === 'comment_replies' || table === 'annotations') return true;
  return role === 'owner' || role === 'editor';
}

function matches<T>(row: T, filter?: Partial<T>) {
  if (!filter) return true;
  return Object.entries(filter).every(([key, value]) => (row as Record<string, unknown>)[key] === value);
}

const clone = <T>(value: T): T => structuredClone(value);

function createTableAdapter<K extends TableName>(db: MemoryDatabase, table: K, getUserId: () => string | null): RecordAdapter<Rows[K]> {
  type Row = Rows[K];
  const store = db[table] as Map<string, Row>;
  const now = () => new Date().toISOString();
  const visible = (row: Row) => allowed(db, table, row as unknown as Record<string, unknown>, getUserId(), 'read');

  return {
    async list(filter) {
      return [...store.values()].filter((row) => visible(row) && matches(row, filter)).map(clone)
        .sort((a, b) => (a as BaseRow).created_at.localeCompare((b as BaseRow).created_at));
    },
    async get(id) {
      const row = store.get(id);
      return row && visible(row) ? clone(row) : null;
    },
    async insert(input: NewRow<Row>) {
      const userId = getUserId();
      if (!userId) throw new ServiceError('rls-denied', 'Not signed in.');
      if (store.has(input.id)) throw new ServiceError('invalid', 'Duplicate id.');
      const stamp = now();
      const row = { ...defaults[table], ...input, created_at: stamp, updated_at: stamp } as unknown as Row;
      const record = row as unknown as Record<string, unknown>;
      if (table === 'projects') {
        record.owner_id ??= userId;
        if (record.owner_id !== userId) throw new ServiceError('rls-denied');
      } else if (!allowed(db, table, record, userId, 'write')) {
        throw new ServiceError('rls-denied');
      }
      if (table === 'comment_replies') {
        record.author_id ??= userId;
        if (record.author_id !== userId) throw new ServiceError('rls-denied');
      }
      store.set(input.id, row);
      if (table === 'projects') {
        // Mirrors the projects_add_owner_member trigger.
        db.project_members.set(`owner:${input.id}`, {
          id: `owner:${input.id}`, created_at: stamp, updated_at: stamp, project_id: input.id, user_id: userId, role: 'owner',
        });
      }
      return clone(row);
    },
    async update(id, patch) {
      const row = store.get(id);
      const userId = getUserId();
      if (!row || !visible(row)) throw new ServiceError('not-found');
      const record = row as unknown as Record<string, unknown>;
      const ok = table === 'comment_replies' ? record.author_id === userId : allowed(db, table, record, userId, 'write');
      if (!ok) throw new ServiceError('rls-denied');
      const next = { ...row, ...patch, id, created_at: (row as BaseRow).created_at, updated_at: now() } as Row;
      store.set(id, next);
      return clone(next);
    },
    async remove(id) {
      const row = store.get(id);
      const userId = getUserId();
      if (!row || !visible(row)) return; // like SQL: deleting an invisible row affects nothing
      const record = row as unknown as Record<string, unknown>;
      const ok = table === 'projects' ? record.owner_id === userId
        : table === 'comment_replies' ? record.author_id === userId || allowed(db, 'comments', { project_id: projectOf(db, table, record) }, userId, 'write') && roleIn(db, projectOf(db, table, record), userId) !== 'commenter'
          : allowed(db, table, record, userId, 'write');
      if (!ok) return;
      store.delete(id);
      if (table === 'projects') cascadeProject(db, id);
    },
  };
}

function cascadeProject(db: MemoryDatabase, projectId: string) {
  const sessions = [...db.sessions.values()].filter((s) => s.project_id === projectId).map((s) => s.id);
  const lists = [...db.production_lists.values()].filter((l) => sessions.includes(l.session_id)).map((l) => l.id);
  const comments = [...db.comments.values()].filter((c) => c.project_id === projectId).map((c) => c.id);
  const frames = [...db.frames.values()].filter((f) => f.project_id === projectId).map((f) => f.id);
  const drop = <K extends TableName>(table: K, test: (row: Rows[K]) => boolean) => {
    for (const [id, row] of db[table] as Map<string, Rows[K]>) if (test(row)) (db[table] as Map<string, Rows[K]>).delete(id);
  };
  drop('production_items', (r) => lists.includes(r.list_id));
  drop('production_lists', (r) => lists.includes(r.id));
  drop('change_records', (r) => sessions.includes(r.session_id));
  drop('comment_replies', (r) => comments.includes(r.comment_id));
  drop('annotations', (r) => frames.includes(r.frame_id));
  for (const table of ['project_members', 'frames', 'sessions', 'comments', 'design_tokens', 'looks', 'agent_tokens'] as const) {
    drop(table, (r) => (r as { project_id: string }).project_id === projectId);
  }
}

export function createMemoryAdapters(db: MemoryDatabase, getUserId: () => string | null): AdapterSet {
  return Object.fromEntries(tableNames.map((name) => [name, createTableAdapter(db, name, getUserId)])) as unknown as AdapterSet;
}

/** Mirrors the on_auth_user_created_seed_demo trigger. */
export function seedDemoProject(db: MemoryDatabase, userId: string) {
  const stamp = new Date().toISOString();
  const id = crypto.randomUUID();
  db.projects.set(id, { id, created_at: stamp, updated_at: stamp, owner_id: userId, repo_url: null, design_md: null, ...DEMO_PROJECT });
  db.project_members.set(`owner:${id}`, { id: `owner:${id}`, created_at: stamp, updated_at: stamp, project_id: id, user_id: userId, role: 'owner' });
  return id;
}
