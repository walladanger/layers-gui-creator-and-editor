import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DialogProvider } from '../../dialogs/DialogProvider';
import { ConnectedEditorStatus } from '../canvas/EditorStatus';
import { seedDemoProject } from '../../services/memoryAdapter';
import { createMemoryRuntime } from '../../services/runtime';
import { ServicesProvider } from '../../services/ServicesProvider';
import { ProjectsPage } from './ProjectsPage';

function setup() {
  const user = { id: crypto.randomUUID(), email: 'warwick@example.com' };
  const runtime = createMemoryRuntime({ user });
  seedDemoProject(runtime.db, user.id);
  render(
    <ServicesProvider runtime={runtime}>
      <DialogProvider><ProjectsPage /><ConnectedEditorStatus /></DialogProvider>
    </ServicesProvider>,
  );
  return { runtime, ui: userEvent.setup() };
}

test('lists the seeded demo project', async () => {
  setup();
  expect(await screen.findByText('Demo: Radium Ollama')).toBeInTheDocument();
});

test('creates, renames and deletes a project with a confirm dialog', async () => {
  const { runtime, ui } = setup();
  await screen.findByText('Demo: Radium Ollama');

  await ui.click(screen.getByText('Advanced: connect an already-running web app'));
  await ui.type(screen.getByLabelText('Name'), 'Radium');
  await ui.type(screen.getByLabelText('App address'), 'http://localhost:5173');
  await ui.click(screen.getByRole('button', { name: 'Create project' }));
  expect(await screen.findByText('Radium')).toBeInTheDocument();
  await waitFor(() => expect([...runtime.db.projects.values()].some((p) => p.name === 'Radium' && p.target_url === 'http://localhost:5173')).toBe(true));

  await ui.click(screen.getByRole('button', { name: 'Rename Radium' }));
  const input = screen.getByLabelText('Project name');
  await ui.clear(input);
  await ui.type(input, 'Radium Studio');
  await ui.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Radium Studio')).toBeInTheDocument();

  await ui.click(screen.getByRole('button', { name: 'Delete Radium Studio' }));
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveTextContent('Delete Radium Studio?');
  await ui.click(within(dialog).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(screen.queryByText('Radium Studio')).not.toBeInTheDocument());
  await waitFor(() => expect([...runtime.db.projects.values()].map((p) => p.name)).toEqual(['Demo: Radium Ollama']));
});

test('a live project needs an app address', async () => {
  const { ui } = setup();
  await ui.click(screen.getByText('Advanced: connect an already-running web app'));
  await ui.type(screen.getByLabelText('Name'), 'No address');
  await ui.click(screen.getByRole('button', { name: 'Create project' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Enter the app address');
});

test('the status bar shows unsynced writes from the queued writer', async () => {
  const { runtime, ui } = setup();
  await screen.findByText('Demo: Radium Ollama');
  const block = vi.spyOn(runtime.writer, 'flush').mockResolvedValue(undefined);
  await ui.click(screen.getByText('Advanced: connect an already-running web app'));
  await ui.type(screen.getByLabelText('Name'), 'Offline app');
  await ui.selectOptions(screen.getByLabelText('Mode'), 'demo');
  await ui.click(screen.getByRole('button', { name: 'Create project' }));
  expect(await screen.findByLabelText('Unsynced changes')).toHaveTextContent('1 unsynced');
  block.mockRestore();
  await runtime.writer.flush();
  await waitFor(() => expect(screen.getByLabelText('Unsynced changes')).toHaveTextContent('0 unsynced'));
});

test('Add Application is primary and manual server address is hidden under Advanced', async () => {
  const { ui } = setup();
  expect(screen.getByRole('button', { name: 'Add Application' })).toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'App address' })).not.toBeInTheDocument();
  await ui.click(screen.getByText('Advanced: connect an already-running web app'));
  expect(screen.getByRole('textbox', { name: 'App address' })).toBeInTheDocument();
});
