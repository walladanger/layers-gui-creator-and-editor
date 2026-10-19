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
