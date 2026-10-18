import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskTree } from './TaskTree';

const n = (id: string, label: string, done = true, children: unknown[] = []) => ({ id, label, done, children });
const fixture = [
  n('a', 'Task 31: TurboQuant ON by default (D41)'),
  n('b', 'T30-S05: submit retry'),
  n('c', 'Building video frame extractor', true, [
    n('c1', 'Adding Continue button to video assets'),
    n('c2', 'Wiring last frame as init_image', true, [n('c3', 'Adding continue-last-video in chat'), n('c4', 'Surfacing end_image conditioning')]),
  ]),
  n('d', 'Verify, commit, and open PR'),
];

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem('layers.productionTasks.v3', JSON.stringify(fixture));
});

test('starts with the focused Layers list when nothing is saved', () => {
  window.localStorage.clear();
  render(<TaskTree />);
  expect(screen.getByText('Mermaid whiteboard')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add task' })).toBeInTheDocument();
});

test('clicking a circle toggles the task done state and persists it', async () => {
  const user = userEvent.setup();
  render(<TaskTree />);
  const dot = screen.getByRole('button', { name: 'Mark "Task 31: TurboQuant ON by default (D41)" as not done' });
  expect(dot).toHaveAttribute('aria-pressed', 'true');
  await user.click(dot);
  expect(screen.getByRole('button', { name: 'Mark "Task 31: TurboQuant ON by default (D41)" as done' })).toHaveAttribute('aria-pressed', 'false');
  expect(window.localStorage.getItem('layers.productionTasks.v3')).toContain('TurboQuant');
});

test('double-click renames a task in place', async () => {
  const user = userEvent.setup();
  render(<TaskTree />);
  await user.dblClick(screen.getByText('T30-S05: submit retry'));
  const input = screen.getByDisplayValue('T30-S05: submit retry');
  await user.clear(input);
  await user.type(input, 'T30-S05: retry with backoff{Enter}');
  expect(screen.getByText('T30-S05: retry with backoff')).toBeInTheDocument();
});

test('add task creates a new editable top-level task', async () => {
  const user = userEvent.setup();
  render(<TaskTree />);
  await user.click(screen.getByRole('button', { name: 'Add task' }));
  const input = screen.getByDisplayValue('New task');
  await user.clear(input);
  await user.type(input, 'My brand new task{Enter}');
  expect(screen.getByText('My brand new task')).toBeInTheDocument();
});

test('delete asks for confirmation and removes the subtree', async () => {
  const user = userEvent.setup();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<TaskTree />);
  await user.click(screen.getByRole('button', { name: 'Delete "Building video frame extractor"' }));
  expect(confirm).toHaveBeenCalledWith('Delete "Building video frame extractor" and its 4 sub-tasks?');
  expect(screen.queryByText('Building video frame extractor')).not.toBeInTheDocument();
  expect(screen.queryByText('Adding Continue button to video assets')).not.toBeInTheDocument();
  confirm.mockRestore();
});

test('tasks survive a remount (persistence round-trip)', async () => {
  const user = userEvent.setup();
  const { unmount } = render(<TaskTree />);
  await user.click(screen.getByRole('button', { name: 'Mark "Verify, commit, and open PR" as not done' }));
  unmount();
  render(<TaskTree />);
  expect(screen.getByRole('button', { name: 'Mark "Verify, commit, and open PR" as done' })).toBeInTheDocument();
});
