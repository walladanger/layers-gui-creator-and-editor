import { render, screen } from '@testing-library/react';
import { createMemoryRuntime } from '../services/runtime';
import { App } from './App';

test('renders the Radium Panel Lab Studio shell for a signed-in user', async () => {
  render(<App runtime={createMemoryRuntime({ user: { id: 'u1', email: 'a@example.com' } })} />);
  expect((await screen.findAllByText('Radium Panel Lab Studio'))[0]).toBeInTheDocument();
});

test('shows sign-in when nobody is signed in', async () => {
  render(<App runtime={createMemoryRuntime()} />);
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
});
