import { render, screen } from '@testing-library/react';
import { App } from './App';

test('renders the Radium Panel Lab Studio shell', () => {
  render(<App />);
  expect(screen.getAllByText('Radium Panel Lab Studio')[0]).toBeInTheDocument();
});
