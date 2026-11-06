import { render, screen } from '@testing-library/react';
import { createMemoryRuntime } from '../services/runtime';
import { App } from './App';

test('renders the Layers GUI Creator and Editor shell for a signed-in user', async () => {
  render(<App runtime={createMemoryRuntime({ user: { id: 'u1', email: 'a@example.com' } })} />);
  expect((await screen.findAllByText('Layers GUI Creator and Editor'))[0]).toBeInTheDocument();
});

test('opens straight into the workspace with no login page', async () => {
  render(<App runtime={createMemoryRuntime()} />);
  expect(await screen.findByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
});

test('fresh signed-in workspace presents Select Folder, GitHub Project and Assets instead of a default demo', async () => {
  render(<App runtime={createMemoryRuntime({ user: { id: 'u-empty', email: 'empty@example.com' } })} />);
  expect(await screen.findByRole('heading', { name: 'Ready to load a page' })).toBeInTheDocument();
  for (const name of ['Select Folder', 'GitHub Project', 'Assets']) {
    expect(screen.getByRole('button', { name })).toBeInTheDocument();
  }
  expect(screen.queryByTitle(/Radium Ollama/)).not.toBeInTheDocument();
});
