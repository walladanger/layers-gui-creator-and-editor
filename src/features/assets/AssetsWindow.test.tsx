import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEMOS } from '../../asset-stage/demos';
import { AssetsWindow } from './AssetsWindow';

test('component browser shows the interactive preview and copyable example without opening the source drawer', async () => {
  const user = userEvent.setup();
  render(<AssetsWindow />);

  expect(screen.getByRole('heading', { name: 'Example code' })).toBeInTheDocument();
  expect(screen.getByTitle('Button live preview')).toHaveAttribute('src', '/asset-stage.html?theme=dark#shadcn%3Abutton');
  expect(screen.getByRole('button', { name: 'Insert into app' })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Accordion' }));
  expect(screen.getByTitle('Accordion live preview')).toBeInTheDocument();
  expect(screen.getByText(/What is your return policy\?/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Copy example' })).toBeInTheDocument();
});

test('accordion live demo presents three complete FAQ rows and an expanded answer', () => {
  render(<>{DEMOS['shadcn:accordion'].main()}</>);

  expect(screen.getByRole('button', { name: 'What are your shipping options?' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'What is your return policy?' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('button', { name: 'How can I contact customer support?' })).toBeInTheDocument();
  expect(screen.getByText(/Returns accepted within 30 days/)).toBeVisible();
});
