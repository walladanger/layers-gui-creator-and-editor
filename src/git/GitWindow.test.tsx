import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemorySource, type Commit } from './gitCore';
import { GitWindow } from './GitWindow';

const commit = (n: number, subject: string, day: string, refs: Commit['refs'] = []): Commit => ({
  sha: String(n).repeat(40).slice(0, 40), short: String(n).repeat(7), author: 'Ann', email: 'a@x.io',
  date: `${day}T10:00:00Z`, parents: [], refs, subject, body: n === 2 ? 'Longer body text' : '', type: subject.split(':')[0] ?? null,
});

const commits = [
  commit(2, 'fix: second commit', '2026-10-02', [{ kind: 'branch', name: 'main' }, { kind: 'tag', name: 'v1' }]),
  commit(1, 'feat: first commit', '2026-10-01'),
];
const source = () => createMemorySource(commits, {
  label: 'demo',
  details: { [commits[0].sha]: { files: [{ path: 'a.txt', oldPath: null, additions: 1, deletions: 0, binary: false }], diff: 'diff --git a/a.txt b/a.txt\n@@ -1 +1,2 @@\n one\n+two' } },
  status: { available: true, branch: 'main', ahead: 1, behind: 0, files: [{ path: 'x', staged: false, state: 'modified', code: ' M' }] },
});

test('lists commits grouped by day with refs, branch and uncommitted count', async () => {
  render(<GitWindow initialSource={source()} />);
  expect(await screen.findByText('fix: second commit')).toBeInTheDocument();
  expect(screen.getByText('feat: first commit')).toBeInTheDocument();
  expect(screen.getByText('2026-10-02')).toBeInTheDocument();
  expect(screen.getByText('v1')).toBeInTheDocument();
  expect(await screen.findByText('1 uncommitted change')).toBeInTheDocument();
  expect(screen.getByTitle('Commits not pushed')).toHaveTextContent('↑1');
});

test('expanding a commit shows its files and a file diff', async () => {
  const user = userEvent.setup();
  render(<GitWindow initialSource={source()} />);
  await user.click(await screen.findByRole('button', { name: /fix: second commit/ }));
  expect(await screen.findByText('Longer body text')).toBeInTheDocument();
  await user.click(await screen.findByRole('button', { name: /a\.txt/ }));
  expect(await screen.findByLabelText('Diff')).toHaveTextContent('+two');
});

test('searching filters the list', async () => {
  const user = userEvent.setup();
  render(<GitWindow initialSource={source()} />);
  await screen.findByText('fix: second commit');
  await user.type(screen.getByLabelText('Search messages'), 'first');
  await waitFor(() => expect(screen.queryByText('fix: second commit')).not.toBeInTheDocument());
  expect(screen.getByText('feat: first commit')).toBeInTheDocument();
});

test('in the browser preview it offers the GitHub source and rejects bad input', async () => {
  const user = userEvent.setup();
  render(<GitWindow />);
  await user.type(screen.getByLabelText('GitHub repository'), 'not a repo');
  await user.click(screen.getByRole('button', { name: 'Load' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('owner/repo');
});
