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
