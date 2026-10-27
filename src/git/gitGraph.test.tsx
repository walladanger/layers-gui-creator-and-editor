import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemorySource, layoutBranchLanes, layoutGraph, renderGraphGutter, renderGraphHorizontal, renderGraphRow, type Commit } from './gitCore';
import { GitWindow } from './GitWindow';

const c = (sha: string, parents: string[], subject: string, day = '2026-10-01', refs: Commit['refs'] = []): Commit => ({
  sha, short: sha, author: 'Ann', email: 'a@x.io', date: `${day}T10:00:00Z`, parents, refs, subject, body: '', type: null,
});

// newest first, topological: M merges feature (f2) into main (m1); both descend from base.
const history = [
  c('M', ['m1', 'f2'], 'Merge feature'),
  c('f2', ['f1'], 'feat: two'),
  c('f1', ['base'], 'feat: one'),
  c('m1', ['base'], 'fix: main work'),
  c('base', [], 'feat: base'),
];

test('layoutGraph gives a merge two outgoing lines, uses a second lane, and closes every lane at the root', () => {
  const { rows, lanes } = layoutGraph(history);
  expect(rows).toHaveLength(5);
  expect(lanes).toBeGreaterThanOrEqual(2);
  expect(rows[0].merge).toBe(true);
  expect(rows[0].outs).toHaveLength(2);
  expect(rows[4].outs).toHaveLength(0);
  const open = new Set<number>();
  for (const row of rows) {
    for (const t of row.through) expect(open.has(t.lane)).toBe(true);
    for (const i of row.ins) open.delete(i.lane);
    for (const o of row.outs) open.add(o.lane);
  }
  expect(open.size).toBe(0);
});

test('a tip whose parent already has a lane does not leave a phantom lane behind', () => {
  const { rows } = layoutGraph([c('tip2', ['x'], 'other'), c('tip1', ['x'], 'main'), c('x', [], 'root')]);
  expect(rows[2].through).toHaveLength(0);
  expect(rows[2].ins.length).toBeGreaterThanOrEqual(1);
});

test('a linear history is one lane and the renderers return svg', () => {
  const linear = layoutGraph([c('b', ['a'], 'two'), c('a', [], 'one')]);
  expect(linear.lanes).toBe(1);
  const svg = renderGraphRow(linear.rows[0], linear.lanes);
  expect(svg.startsWith('<svg')).toBe(true);
  expect(svg.match(/<circle/g)).toHaveLength(1);
  expect(renderGraphGutter(linear.rows[0], linear.lanes)).toContain('<line');
});

test('the Git window draws the branch graph and hides it while searching', async () => {
  const user = userEvent.setup();
  const { container } = render(<GitWindow initialSource={createMemorySource(history, { label: 'demo' })} />);
  await screen.findByText('Merge feature');
  expect(container.querySelectorAll('.git-commit[data-graph="on"] svg')).toHaveLength(5);
  await user.type(screen.getByLabelText('Search messages'), 'feat');
  await screen.findByText('feat: two');
  expect(container.querySelectorAll('.git-commit[data-graph="on"]')).toHaveLength(0);
  await user.clear(screen.getByLabelText('Search messages'));
  await user.click(screen.getByRole('button', { name: 'Branch graph' }));
  await screen.findByText('Merge feature');
  expect(container.querySelectorAll('.git-commit[data-graph="on"]')).toHaveLength(0);
});

const branched = [
  c('aaa1', ['bbb1', 'ccc2'], 'Merge feature', '2026-10-01', [{ kind: 'branch', name: 'main' }]),
  c('ccc2', ['ccc1'], 'feat: two', '2026-10-01', [{ kind: 'branch', name: 'feature' }]),
  c('ccc1', ['base'], 'feat: one'),
  c('bbb1', ['base'], 'fix: main work'),
  c('abc0', [], 'feat: base'),
].map((x) => (x.parents[0] === 'base' ? { ...x, parents: ['abc0', ...x.parents.slice(1)] } : x));

test('horizontal layout: main is the top lane and owns its trunk; the branch gets its own lane', () => {
  const { rows, lanes } = layoutBranchLanes(branched);
  expect(lanes.map((l) => l.name)).toEqual(['main', 'feature']);
  expect(rows.map((r) => r.lane)).toEqual([0, 1, 1, 0, 0]);
  expect(rows[0].merge).toBe(true);
});

test('horizontal svg: a clickable dot per commit, lane pills, curves, escaped text', () => {
  const { svg } = renderGraphHorizontal(branched);
  expect(svg.match(/data-sha="/g)).toHaveLength(5);
  expect(svg).toContain('>main</text>');
  expect(svg).toContain('>feature</text>');
  expect(svg).toContain(' Q');
  const evil = renderGraphHorizontal([c('abc1234', [], '"><script>alert(1)</script>')]);
  expect(evil.svg).not.toContain('<script');
});

test('Rotate switches the graph to a horizontal view; clicking a dot opens that commit', async () => {
  localStorage.clear();
  const user = userEvent.setup();
  const { container } = render(<GitWindow initialSource={createMemorySource(branched, { label: 'demo' })} />);
  await screen.findByText('Merge feature');
  expect(container.querySelector('.git-hgraph')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Rotate graph' }));
  expect(container.querySelector('.git-hgraph svg')).not.toBeNull();
  expect(container.querySelectorAll('.git-commit')).toHaveLength(0);
  expect(screen.getByText('Click a dot to see that commit.')).toBeInTheDocument();
  await user.click(container.querySelector('[data-sha="ccc2"]') as Element);
  expect(await screen.findByRole('region', { name: 'Selected commit' })).toHaveTextContent('feat: two');
  await user.click(screen.getByRole('button', { name: 'Rotate graph' }));
  expect(container.querySelector('.git-hgraph')).toBeNull();
  expect(container.querySelectorAll('.git-commit').length).toBeGreaterThan(0);
});
