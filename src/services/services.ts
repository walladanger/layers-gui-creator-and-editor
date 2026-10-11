import { ServiceError, type AdapterSet, type NewRow } from './contracts';
import type { QueuedWriter } from './queuedWriter';
import type {
  AgentToken, Annotation, Frame, ChangeKind, ChangeRecord, ChangeTarget, Comment, CommentReply, DesignToken, Json, Look,
  ProductionItem, ProductionList, Project, Rows, Session, TableName, TargetMode, TokenGroup,
} from './types';

export interface ServiceContext {
  adapters: AdapterSet;
  writer: QueuedWriter;
  getUserId(): string | null;
}

/** Every write goes through the queued writer; the returned row is the optimistic local copy. */
function writes(ctx: ServiceContext) {
  const stamp = () => new Date().toISOString();
  return {
    async insert<K extends TableName>(table: K, row: Omit<NewRow<Rows[K]>, 'id'> & { id?: string }): Promise<Rows[K]> {
      const id = row.id ?? crypto.randomUUID();
      const payload = { ...row, id };
      await ctx.writer.enqueue({ table, action: 'insert', rowId: id, payload });
      const now = stamp();
      return { ...payload, created_at: now, updated_at: now } as unknown as Rows[K];
    },
    async update<K extends TableName>(table: K, id: string, patch: Partial<Rows[K]>) {
      await ctx.writer.enqueue({ table, action: 'update', rowId: id, payload: patch as Record<string, unknown> });
    },
    async remove(table: TableName, id: string) {
      await ctx.writer.enqueue({ table, action: 'delete', rowId: id });
    },
  };
}

function requireUser(ctx: ServiceContext) {
  const id = ctx.getUserId();
  if (!id) throw new ServiceError('rls-denied', 'Sign in first.');
  return id;
}

export interface NewProjectInput { name: string; target_mode: TargetMode; target_url?: string | null }

export function validateProjectInput(input: NewProjectInput): string | null {
  if (!input.name.trim()) return 'Give the project a name.';
  if (input.target_mode !== 'demo') {
    const url = input.target_url?.trim() ?? '';
    if (!/^https?:\/\/\S+$/i.test(url)) return 'Enter the app address, starting with http:// or https://.';
  }
  return null;
}

export class ProjectService {
  private readonly w;
  constructor(private readonly ctx: ServiceContext) { this.w = writes(ctx); }
  list() { return this.ctx.adapters.projects.list(); }
  get(id: string) { return this.ctx.adapters.projects.get(id); }
  async create(input: NewProjectInput): Promise<Project> {
    const problem = validateProjectInput(input);
    if (problem) throw new ServiceError('invalid', problem);
    return this.w.insert('projects', {
      owner_id: requireUser(this.ctx),
      name: input.name.trim(),
      target_mode: input.target_mode,
      target_url: input.target_mode === 'demo' ? '/targets/radium-mock.html' : input.target_url?.trim() ?? null,
    });
  }
  async rename(id: string, name: string) {
    if (!name.trim()) throw new ServiceError('invalid', 'Give the project a name.');
    await this.w.update('projects', id, { name: name.trim() });
  }
  update(id: string, patch: Partial<Pick<Project, 'target_url' | 'target_mode' | 'repo_url' | 'framework' | 'design_md'>>) { return this.w.update('projects', id, patch); }
  remove(id: string) { return this.w.remove('projects', id); }
}

export class SessionService {
  private readonly w;
  constructor(private readonly ctx: ServiceContext) { this.w = writes(ctx); }
  list(projectId: string) { return this.ctx.adapters.sessions.list({ project_id: projectId }); }
  create(projectId: string, name: string, parentSessionId: string | null = null): Promise<Session> {
    return this.w.insert('sessions', { project_id: projectId, name, status: 'open', parent_session_id: parentSessionId });
  }
  /** Branch a session (Onlook-style); the child points at its parent. */
  branch(parent: Session, name: string) { return this.create(parent.project_id, name, parent.id); }
  rename(id: string, name: string) { return this.w.update('sessions', id, { name }); }
  setStatus(id: string, status: Session['status']) { return this.w.update('sessions', id, { status }); }
  remove(id: string) { return this.w.remove('sessions', id); }
}

export interface NewChangeInput {
  session_id: string; frame_id?: string | null; kind: ChangeKind; target: ChangeTarget;
  before?: Json | null; after?: Json | null; css?: string | null; tailwind_hint?: string | null;
}

export class ChangeService {
  private readonly w;
  constructor(private readonly ctx: ServiceContext) { this.w = writes(ctx); }
  list(sessionId: string) { return this.ctx.adapters.change_records.list({ session_id: sessionId }); }
  record(input: NewChangeInput): Promise<ChangeRecord> { return this.w.insert('change_records', input as never); }
  supersede(id: string, byId: string) { return this.w.update('change_records', id, { superseded_by: byId }); }
  setScreenshots(id: string, paths: { before?: string; after?: string }) {
    return this.w.update('change_records', id, { screenshot_before: paths.before ?? null, screenshot_after: paths.after ?? null });
  }
  remove(id: string) { return this.w.remove('change_records', id); }
  /** Storage path contract: screenshots/{project_id}/{change_record_id}-{before|after}.png */
  static screenshotPath(projectId: string, changeRecordId: string, which: 'before' | 'after') {
    return `${projectId}/${changeRecordId}-${which}.png`;
  }
}

export class CommentService {
  private readonly w;
  constructor(private readonly ctx: ServiceContext) { this.w = writes(ctx); }
  list(projectId: string) { return this.ctx.adapters.comments.list({ project_id: projectId }); }
  add(input: Pick<Comment, 'project_id' | 'text'> & Partial<Pick<Comment, 'session_id' | 'frame_id' | 'target' | 'px' | 'py'>>): Promise<Comment> {
    return this.w.insert('comments', { author_kind: 'user', status: 'open', target: {}, ...input });
  }
  setStatus(id: string, status: Comment['status']) { return this.w.update('comments', id, { status }); }
  edit(id: string, text: string) { return this.w.update('comments', id, { text }); }
  remove(id: string) { return this.w.remove('comments', id); }
  replies(commentId: string) { return this.ctx.adapters.comment_replies.list({ comment_id: commentId }); }
  reply(commentId: string, text: string): Promise<CommentReply> {
    return this.w.insert('comment_replies', { comment_id: commentId, text, author_kind: 'user', author_id: requireUser(this.ctx) });
  }
  annotations(frameId: string) { return this.ctx.adapters.annotations.list({ frame_id: frameId }); }
  annotate(input: Pick<Annotation, 'frame_id' | 'shapes'> & Partial<Pick<Annotation, 'comment_id' | 'color'>>): Promise<Annotation> {
    return this.w.insert('annotations', input);
  }
}

export class ProductionService {
  private readonly w;
  constructor(private readonly ctx: ServiceContext) { this.w = writes(ctx); }
  lists(sessionId: string) { return this.ctx.adapters.production_lists.list({ session_id: sessionId }); }
  createList(input: Pick<ProductionList, 'session_id' | 'version'> & Partial<Pick<ProductionList, 'markdown' | 'json'>>): Promise<ProductionList> {
    return this.w.insert('production_lists', { status: 'draft', ...input });
  }
  setListStatus(id: string, status: ProductionList['status']) { return this.w.update('production_lists', id, { status }); }
  items(listId: string) { return this.ctx.adapters.production_items.list({ list_id: listId }); }
  addItem(input: Pick<ProductionItem, 'list_id' | 'seq' | 'title'> & Partial<Omit<ProductionItem, 'id' | 'created_at' | 'updated_at'>>): Promise<ProductionItem> {
    return this.w.insert('production_items', input);
  }
  updateItem(id: string, patch: Partial<Pick<ProductionItem, 'status' | 'agent' | 'agent_note' | 'pr_url' | 'priority' | 'instructions' | 'acceptance'>>) {
    return this.w.update('production_items', id, patch);
  }
}

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Design tokens (§5 design_tokens) and agent access tokens (§5 agent_tokens). */
export class TokenService {
  private readonly w;
  constructor(private readonly ctx: ServiceContext) { this.w = writes(ctx); }
  list(projectId: string) { return this.ctx.adapters.design_tokens.list({ project_id: projectId }); }
  add(input: { project_id: string; name: string; value: string; group: TokenGroup; source?: DesignToken['source'] }): Promise<DesignToken> {
    return this.w.insert('design_tokens', { source: 'imported', ...input });
  }
  edit(id: string, value: string) { return this.w.update('design_tokens', id, { value, source: 'edited' }); }
  remove(id: string) { return this.w.remove('design_tokens', id); }
  agentTokens(projectId: string) { return this.ctx.adapters.agent_tokens.list({ project_id: projectId }); }
  /** Returns the plaintext once; only its hash is stored. */
  async createAgentToken(projectId: string, label: string): Promise<{ token: AgentToken; plaintext: string }> {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const plaintext = `rpl_${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
    const token = await this.w.insert('agent_tokens', { project_id: projectId, label, token_hash: await sha256Hex(plaintext) });
    return { token, plaintext };
  }
  revokeAgentToken(id: string) { return this.w.update('agent_tokens', id, { revoked_at: new Date().toISOString() }); }
}

export class LookService {
  private readonly w;
  constructor(private readonly ctx: ServiceContext) { this.w = writes(ctx); }
  list(projectId: string) { return this.ctx.adapters.looks.list({ project_id: projectId }); }
  save(input: Pick<Look, 'project_id' | 'name'> & Partial<Pick<Look, 'style' | 'edits'>>): Promise<Look> { return this.w.insert('looks', input); }
  rename(id: string, name: string) { return this.w.update('looks', id, { name }); }
  remove(id: string) { return this.w.remove('looks', id); }
}

export const BREAKPOINT_WIDTHS = { desktop: 1440, laptop: 1024, tablet: 768, mobile: 390 } as const;

export function breakpointForWidth(width: number): Frame['breakpoint'] {
  if (width === 1440 || width === 1024) return 'desktop';
  if (width === 768) return 'tablet';
  if (width === 390) return 'mobile';
  return 'custom';
}

export type NewFrameInput = Pick<Frame, 'project_id'> & Partial<Pick<Frame, 'route' | 'label' | 'width' | 'height' | 'canvas_x' | 'canvas_y'>>;

/** Frames on the canvas (§5 frames). */
export class FrameService {
  private readonly w;
  constructor(private readonly ctx: ServiceContext) { this.w = writes(ctx); }
  list(projectId: string) { return this.ctx.adapters.frames.list({ project_id: projectId }); }
  add(input: NewFrameInput): Promise<Frame> {
    const width = input.width ?? 1440;
    return this.w.insert('frames', {
      route: '/', label: null, height: 900, canvas_x: 0, canvas_y: 0, ...input, width, breakpoint: breakpointForWidth(width),
    });
  }
  update(id: string, patch: Partial<Pick<Frame, 'route' | 'label' | 'width' | 'height' | 'canvas_x' | 'canvas_y'>>) {
    const full: Partial<Frame> = { ...patch };
    if (patch.width !== undefined) full.breakpoint = breakpointForWidth(patch.width);
    return this.w.update('frames', id, full);
  }
  remove(id: string) { return this.w.remove('frames', id); }
}

export interface StudioServices {
  frames: FrameService;
  projects: ProjectService;
  sessions: SessionService;
  changes: ChangeService;
  comments: CommentService;
  production: ProductionService;
  tokens: TokenService;
  looks: LookService;
}

export function createServices(ctx: ServiceContext): StudioServices {
  return {
    projects: new ProjectService(ctx),
    frames: new FrameService(ctx),
    sessions: new SessionService(ctx),
    changes: new ChangeService(ctx),
    comments: new CommentService(ctx),
    production: new ProductionService(ctx),
    tokens: new TokenService(ctx),
    looks: new LookService(ctx),
  };
}
