import { createMemoryQueueStore } from './queuedWriter';
import { createMemoryRuntime } from './runtime';
import { runServiceSuite } from './serviceSuite';

runServiceSuite('in-memory adapters', async () => {
  const runtime = createMemoryRuntime({ store: createMemoryQueueStore() });
  const ids = { alice: crypto.randomUUID(), bob: crypto.randomUUID() };
  return {
    services: runtime.services,
    writer: runtime.writer,
    async signInAs(label) { runtime.setCurrentUser({ id: ids[label], email: `${label}@example.com` }); return ids[label]; },
  };
});

test('signing up seeds the "Demo: Radium Ollama" project', async () => {
  const runtime = createMemoryRuntime();
  await runtime.auth.signUp('new@example.com', 'secret1');
  const user = await runtime.auth.getUser();
  runtime.setCurrentUser(user);
  const projects = await runtime.services.projects.list();
  expect(projects.map((p) => [p.name, p.target_mode, p.target_url])).toEqual([['Demo: Radium Ollama', 'demo', '/targets/radium-mock.html']]);
});

test('createFromSource saves a scanned repo as a snapshot project with its repo url', async () => {
  const runtime = createMemoryRuntime();
  await runtime.auth.signUp('saver@example.com', 'secret1');
  runtime.setCurrentUser(await runtime.auth.getUser());
  const project = await runtime.services.projects.createFromSource({ name: 'a/b', source: { kind: 'github', label: 'a/b', repo: 'a/b' } });
  expect(project).toMatchObject({ name: 'a/b', target_mode: 'snapshot', target_url: null, repo_url: 'a/b', framework: 'github' });
  const folder = await runtime.services.projects.createFromSource({ name: 'local-app', source: { kind: 'folder', label: 'local-app' } });
  expect(folder).toMatchObject({ repo_url: null, framework: 'folder' });
  await expect(runtime.services.projects.createFromSource({ name: '  ', source: { kind: 'demo', label: 'Demo' } })).rejects.toThrow('Give the project a name.');
});
