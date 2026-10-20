import { createLocalGitSource, createTauriGitRunner, resolveRepoRoot, type TauriInvoke } from './gitHost';
import { commitType, parseLog, parseNumstat, parseStatus, LOG_FORMAT } from './gitCore';

test('the runner passes the repo and args to the git_run command', async () => {
  const invoke = vi.fn(async () => 'out') as unknown as TauriInvoke;
  expect(await createTauriGitRunner('/r', invoke)(['status'])).toBe('out');
  expect(invoke).toHaveBeenCalledWith('git_run', { repo: '/r', args: ['status'] });
});

test('Tauri { code, message } rejections become Errors', async () => {
  const invoke = (async () => { throw { code: 'invalid-request', message: 'git push is not allowed (read-only)' }; }) as TauriInvoke;
  await expect(createTauriGitRunner('/r', invoke)(['push'])).rejects.toThrow('git push is not allowed');
  await expect(resolveRepoRoot('/x', invoke)).rejects.toThrow('not allowed');
});

test('a local source built on the runner parses git output through the shared core', async () => {
  const rec = ['a'.repeat(40), 'aaaaaaa', 'Ann', 'a@x.io', '2026-10-01T10:00:00+00:00', '', 'HEAD -> main, tag: v1', 'feat(ui): hi', 'body'].join('\x1f') + '\x1e';
  const calls: string[][] = [];
  const invoke = (async (_cmd: string, a?: { args: string[] }) => { calls.push(a!.args); return rec; }) as TauriInvoke;
  const source = createLocalGitSource('C:\\work\\proj', invoke);
  const [first] = await source.log({ limit: 5 });
  expect(source.label).toBe('proj');
  expect(first).toMatchObject({ subject: 'feat(ui): hi', type: 'feat', body: 'body' });
  expect(first.refs).toEqual([{ kind: 'head', name: 'HEAD' }, { kind: 'branch', name: 'main' }, { kind: 'tag', name: 'v1' }]);
  expect(calls[0][0]).toBe('log');
  expect(calls[0]).toContain(`--format=${LOG_FORMAT}`);
  await expect(source.show('--output=/tmp/x')).rejects.toThrow('Bad commit id');
});

test('shared core parsers', () => {
  expect(commitType('fix(ui)!: x')).toBe('fix');
  expect(parseLog('abc\x1fdef')).toEqual([]);
  expect(parseNumstat('-\t-\timg.png\n1\t0\tsrc/{old => new}/a.js\n')).toMatchObject([{ binary: true }, { path: 'src/new/a.js', oldPath: 'src/old/a.js' }]);
  expect(parseStatus('## main...origin/main [ahead 2, behind 1]\n M x.js\n')).toMatchObject({ branch: 'main', ahead: 2, behind: 1 });
});
