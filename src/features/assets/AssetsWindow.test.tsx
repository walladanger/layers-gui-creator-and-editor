import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssetsWindow } from './AssetsWindow';

vi.mock('./IconBrowser', () => ({
  default: ({ query }: { query: string }) => <div data-testid="icon-browser">Icons search: {query}</div>,
}));

test('component catalog remains visible but disabled; icons are the only active library', async () => {
  const user = userEvent.setup();
  render(<AssetsWindow />);

  expect(screen.getByRole('tab', { name: 'Components' })).toBeDisabled();
  expect(screen.getByRole('tab', { name: 'Icons' })).toHaveAttribute('aria-selected', 'true');
  expect(await screen.findByTestId('icon-browser')).toBeInTheDocument();
  expect(screen.queryByRole('list', { name: 'Components' })).not.toBeInTheDocument();
  expect(screen.queryByTitle('Button live preview')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Insert into app' })).not.toBeInTheDocument();

  await user.type(screen.getByRole('textbox', { name: 'Search icons' }), 'file');
  expect(screen.getByText('Icons search: file')).toBeInTheDocument();
});
