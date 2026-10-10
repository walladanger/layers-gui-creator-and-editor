// Row types for §5 of docs/production-plan.md (Contract B). Column names match the database exactly.

export interface BaseRow { id: string; created_at: string; updated_at: string }

export type TargetMode = 'live' | 'demo' | 'snapshot';
export type MemberRole = 'owner' | 'editor' | 'commenter';
export type Breakpoint = 'desktop' | 'tablet' | 'mobile' | 'custom';
export type SessionStatus = 'open' | 'compiled' | 'archived';
export type ChangeKind = 'style' | 'text' | 'move' | 'resize' | 'reorder' | 'hide' | 'delete' | 'insert' | 'token' | 'motion' | 'state-style' | 'note';
export type AuthorKind = 'user' | 'agent';
export type CommentStatus = 'open' | 'done';
export type ListStatus = 'draft' | 'handed-off' | 'done';
export type Priority = 'p1' | 'p2' | 'p3';
export type ItemStatus = 'queued' | 'in-progress' | 'done' | 'rejected' | 'needs-info';
export type TokenGroup = 'color' | 'radius' | 'space' | 'shadow' | 'font' | 'motion';
export type TokenSource = 'imported' | 'edited';
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface ChangeTarget {
  rid?: string; comp?: string; selector?: string; label?: string; textSnippet?: string;
  instanceScope?: 'instance' | 'all'; breakpoint?: string;
}

export interface Project extends BaseRow {
  owner_id: string; name: string; target_url: string | null; target_mode: TargetMode;
  repo_url: string | null; framework: string | null; design_md: string | null;
}
export interface ProjectMember extends BaseRow { project_id: string; user_id: string; role: MemberRole }
export interface Frame extends BaseRow {
  project_id: string; route: string; label: string | null; width: number; height: number;
  canvas_x: number; canvas_y: number; breakpoint: Breakpoint;
}
export interface Session extends BaseRow {
  project_id: string; name: string; status: SessionStatus; parent_session_id: string | null; base_commit: string | null;
}
export interface ChangeRecord extends BaseRow {
  session_id: string; frame_id: string | null; kind: ChangeKind; target: ChangeTarget;
  before: Json | null; after: Json | null; css: string | null; tailwind_hint: string | null;
  screenshot_before: string | null; screenshot_after: string | null; superseded_by: string | null;
}
export interface Comment extends BaseRow {
  project_id: string; session_id: string | null; frame_id: string | null; target: ChangeTarget;
  px: number | null; py: number | null; text: string; status: CommentStatus; author_kind: AuthorKind;
}
export interface CommentReply extends BaseRow { comment_id: string; author_kind: AuthorKind; author_id: string | null; text: string }
export interface Annotation extends BaseRow { comment_id: string | null; frame_id: string; shapes: Json; color: string | null }
export interface ProductionList extends BaseRow {
  session_id: string; version: number; markdown: string | null; json: Json | null; status: ListStatus;
}
export interface ProductionItem extends BaseRow {
  list_id: string; seq: number; title: string; file: string | null; line: number | null; component: string | null;
  instructions: string | null; acceptance: string[]; change_record_ids: string[]; priority: Priority;
  status: ItemStatus; agent: string | null; agent_note: string | null; pr_url: string | null;
}
export interface DesignToken extends BaseRow { project_id: string; name: string; value: string; group: TokenGroup; source: TokenSource }
export interface Look extends BaseRow { project_id: string; name: string; style: Json; edits: Json }
export interface AgentToken extends BaseRow {
  project_id: string; label: string; token_hash: string; last_used_at: string | null; revoked_at: string | null;
}

export interface Rows {
  projects: Project;
  project_members: ProjectMember;
  frames: Frame;
  sessions: Session;
  change_records: ChangeRecord;
  comments: Comment;
  comment_replies: CommentReply;
  annotations: Annotation;
  production_lists: ProductionList;
  production_items: ProductionItem;
  design_tokens: DesignToken;
  looks: Look;
  agent_tokens: AgentToken;
}

export type TableName = keyof Rows;

export const tableNames: readonly TableName[] = [
  'projects', 'project_members', 'frames', 'sessions', 'change_records', 'comments', 'comment_replies',
  'annotations', 'production_lists', 'production_items', 'design_tokens', 'looks', 'agent_tokens',
];

export const DEMO_PROJECT = {
  name: 'Demo: Radium Ollama',
  target_url: '/targets/radium-mock.html',
  target_mode: 'demo' as TargetMode,
  framework: 'unknown',
};
