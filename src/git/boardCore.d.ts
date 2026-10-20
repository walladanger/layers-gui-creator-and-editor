// Types for boardCore.js (board-core). Keep this file next to boardCore.js.

export interface BoardItem { id: string; status: string; branch?: string | null }
export interface WorkInfo { base: string | null; branches: { name: string; ahead: number; current?: boolean }[] }

export type ColumnKind = "open" | "plan" | "doing" | "branch" | "done";
export interface BoardColumn<T extends BoardItem = BoardItem> {
  id: string;
  kind: ColumnKind;
  title: string;
  items: T[];
  /** branch columns only */
  branch?: string;
  ahead?: number;
  current?: boolean;
  /** nothing ahead of the base branch: merged, or not started */
  idle?: boolean;
  /** the card's branch no longer exists */
  missing?: boolean;
}
export interface Board<T extends BoardItem = BoardItem> { base: string | null; columns: BoardColumn<T>[]; known: Set<string> }

export function buildBoard<T extends BoardItem>(input: { items: T[]; work?: WorkInfo }): Board<T>;
/** Patch to append when an item is dropped on a column. */
export function moveTo(column: Pick<BoardColumn, "kind" | "branch">): { status: "open" | "plan" | "doing" | "done"; branch?: string | null };
export function finishable(board: Board): string[];
export function columnOf<T extends BoardItem>(board: Board<T>, id: string): BoardColumn<T> | null;
