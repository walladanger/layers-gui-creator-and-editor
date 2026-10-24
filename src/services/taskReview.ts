import type { TaskNode } from './taskTracker';

export type ReviewAction = 'rewrite' | 'subtasks' | 'priority' | 'donecheck' | 'questions';
export const REVIEW_OPTIONS: { id: ReviewAction; label: string }[] = [
  { id: 'rewrite', label: 'Rewrite clearly' },
  { id: 'subtasks', label: 'Suggest sub-tasks' },
  { id: 'priority', label: 'Suggest priority and kind' },
  { id: 'donecheck', label: 'Write the done-check' },
  { id: 'questions', label: 'Ask me questions' },
];

export interface ReviewSuggestion {
  title?: string; notes?: string; subtasks?: string[]; kind?: string; priority?: string; reason?: string; questions?: string[];
}

/** Ask the AI for a suggestion. Nothing is changed until the user accepts it. */
export async function requestReview(action: ReviewAction, task: TaskNode): Promise<ReviewSuggestion> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!base || !key) throw new Error('AI review is not available offline.');
  const { source, ...rest } = task;
  const payload = { ...rest, children: task.children.map(c => c.label), source: source ? { ...source, screenshot: undefined } : undefined };
  const res = await fetch(`${base}/functions/v1/review-task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ action, task: payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Review failed');
  return data.suggestion as ReviewSuggestion;
}
