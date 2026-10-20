import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemorySource } from './gitCore';
import { BoardWindow, PlanView } from './BoardWindow';
import { patchTask, validateTaskTree, type TaskNode } from '../services/taskTracker';
import { TASK_TREE_KEY } from '../services/taskTracker';

const node = (id: string, label: string, extra: Partial<TaskNode> = {}): TaskNode => ({ id, label, done: false, children: [], ...extra });
const seed = (tasks: TaskNode[]) => localStorage.setItem(TASK_TREE_KEY, JSON.stringify(tasks));
const work = { base: 'main', branches: [{ name: 'feat-x', tip: 'a', ahead: 2, current: false }, { name: 'feat-y', tip: 'b', ahead: 1, current: false }] };
const col = (name: string) => screen.getByRole('region', { name });

beforeEach(() => localStorage.clear());

test('patchTask keeps done in step with status and appends plan revisions', () => {
  const t = [node('a', 'A')];
  const p1 = patchTask(t, 'a', { plan: 'one' }, '2026-01-01T00:00:00Z');
  const p2 = patchTask(p1, 'a', { status: 'doing', branch: 'feat-x', plan: 'two' }, '2026-01-02T00:00:00Z');
  expect(p2[0]).toMatchObject({ status: 'doing', branch: 'feat-x', plan: 'two', done: false });
  expect(p2[0].planHistory?.map((r) => r.text)).toEqual(['one', 'two']);
  expect(patchTask(p2, 'a', { status: 'done' })[0].done).toBe(true);
  expect(validateTaskTree(p2)).not.toBeNull();
  expect(validateTaskTree([{ id: 'old', label: 'old', done: false, children: [] }])).not.toBeNull();
});

test('columns: Open, Plan, one per working branch, Done; cards land by status and branch', () => {
  seed([node('1', 'Bug spotted'), node('2', 'Fix being planned', { status: 'plan' }), node('3', 'On x', { status: 'doing', branch: 'feat-x' }), node('4', 'Shipped', { done: true })]);
  render(<BoardWindow work={work} initialSource={createMemorySource([], { label: 'demo' })} />);
  expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual(['Open', 'Plan', 'feat-x', 'feat-y', 'Done']);
  expect(within(col('Open')).getByText('Bug spotted')).toBeInTheDocument();
  expect(within(col('Plan')).getByText('Fix being planned')).toBeInTheDocument();
  expect(within(col('feat-x')).getByText('On x')).toBeInTheDocument();
  expect(within(col('Done')).getByText('Shipped')).toBeInTheDocument();
});

test('Move to changes the column and is saved', async () => {
  const user = userEvent.setup();
  seed([node('1', 'Bug spotted')]);
  render(<BoardWindow work={work} initialSource={createMemorySource([], { label: 'demo' })} />);
  await user.selectOptions(within(col('Open')).getByLabelText('Move to'), 'plan');
  expect(within(col('Plan')).getByText('Bug spotted')).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(TASK_TREE_KEY) ?? '[]')[0].status).toBe('plan');
});

test('a card opens its plan: write, revise, view and restore a revision', async () => {
  const user = userEvent.setup();
  seed([node('1', 'Fix resize', { status: 'plan' })]);
  render(<BoardWindow work={work} initialSource={createMemorySource([], { label: 'demo' })} />);
  await user.click(screen.getByText('Fix resize'));
  expect(screen.getByText(/No plan yet/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Write plan/ }));
  const box = screen.getByLabelText('Plan text');
  await user.clear(box); await user.type(box, '# First plan');
  await user.click(screen.getByRole('button', { name: 'Save revision' }));
  await user.click(screen.getByRole('button', { name: /Edit plan/ }));
  await user.clear(screen.getByLabelText('Plan text')); await user.type(screen.getByLabelText('Plan text'), '# Second plan');
  await user.click(screen.getByRole('button', { name: 'Save revision' }));
  expect(screen.getByText('revision 2')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '1' }));
  expect(screen.getByText('First plan')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Restore as new revision' }));
  expect(screen.getByText('revision 3')).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(TASK_TREE_KEY) ?? '[]')[0].planHistory).toHaveLength(3);
});

test('Start on a branch card hands the agent the plan', async () => {
  const user = userEvent.setup();
  const onStart = vi.fn();
  seed([node('3', 'On x', { status: 'doing', branch: 'feat-x', plan: '# Do it' })]);
  render(<BoardWindow work={work} onStart={onStart} initialSource={createMemorySource([], { label: 'demo' })} />);
  expect(within(col('Open')).queryByRole('button', { name: /Start/ })).toBeNull();
  await user.click(within(col('feat-x')).getByRole('button', { name: /Start/ }));
  expect(onStart).toHaveBeenCalledWith({ id: '3', label: 'On x', branch: 'feat-x', plan: '# Do it' });
});

test('Finish merged moves cards on an idle branch to Done', async () => {
  const user = userEvent.setup();
  seed([node('3', 'Merged one', { status: 'doing', branch: 'feat-x' })]);
  render(<BoardWindow work={{ base: 'main', branches: [{ name: 'feat-x', tip: 'a', ahead: 0, current: false }] }} initialSource={createMemorySource([], { label: 'demo' })} />);
  await user.click(screen.getByRole('button', { name: /Finish merged \(1\)/ }));
  expect(within(col('Done')).getByText('Merged one')).toBeInTheDocument();
});

test('PlanView renders headings, checklist, code and inline styles', () => {
  const { container } = render(<PlanView text={'# T\n- [x] done\n- [ ] **bold** `code`\n```\nx=1\n```'} />);
  expect(container.querySelectorAll('input[type=checkbox]')).toHaveLength(2);
  expect(container.querySelector('pre')?.textContent).toBe('x=1');
  expect(container.querySelector('strong')?.textContent).toBe('bold');
});
