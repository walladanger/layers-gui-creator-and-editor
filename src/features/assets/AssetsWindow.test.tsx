import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEMOS } from '../../asset-stage/demos';
import { COMPONENT_CATALOG } from './officialCatalog';
import { SHADCN_ASSETS } from './catalog';
import { AssetsWindow } from './AssetsWindow';

test('component browser shows compact interactive demo and matching copyable code', async () => {
  const user = userEvent.setup();
  render(<AssetsWindow />);

  expect(screen.getByRole('heading', { name: 'Example code' })).toBeInTheDocument();
  expect(screen.getByTitle('Accordion live preview')).toHaveAttribute('src', '/asset-stage.html?theme=dark#shadcn%3Aaccordion');
  expect(screen.getByRole('button', { name: 'Insert into app' })).toBeEnabled();
  expect(screen.getByText(/What is your return policy\?/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Copy example' })).toBeInTheDocument();

  const list = screen.getByRole('list', { name: 'Components' });
  await user.click(within(list).getByRole('button', { name: /^Button\b/ }));
  expect(screen.getByTitle('Button live preview')).toBeInTheDocument();
});

test('attachment has a real local preview while unbundled official components link to documentation', async () => {
  const user = userEvent.setup();
  render(<AssetsWindow />);

  const list = screen.getByRole('list', { name: 'Components' });
  await user.click(within(list).getByRole('button', { name: /^Attachment\b/ }));
  expect(screen.getByTitle('Attachment live preview')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Insert into app' })).toBeEnabled();

  await user.click(within(list).getByRole('button', { name: /^Breadcrumb\b/ }));
  expect(screen.queryByTitle('Breadcrumb live preview')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Insert into app' })).toBeDisabled();
  expect(screen.getByRole('link', { name: 'View Breadcrumb documentation' })).toHaveAttribute('href', 'https://ui.shadcn.com/docs/components/base/breadcrumb');
});

test('official catalog includes current docs and every locally bundled component', () => {
  expect(COMPONENT_CATALOG.length).toBeGreaterThan(60);
  expect(COMPONENT_CATALOG.map(a => a.name)).toEqual(expect.arrayContaining(['Attachment', 'Message Scroller', 'Data Table', 'Sidebar', 'Trace']));
  for (const asset of SHADCN_ASSETS) {
    expect(COMPONENT_CATALOG.find(a => a.id === asset.id)).toBe(asset);
  }
});

test('accordion live demo presents three complete FAQ rows and an expanded answer', () => {
  render(<>{DEMOS['shadcn:accordion'].main()}</>);

  expect(screen.getByRole('button', { name: 'What are your shipping options?' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'What is your return policy?' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('button', { name: 'How can I contact customer support?' })).toBeInTheDocument();
  expect(screen.getByText(/Returns accepted within 30 days/)).toBeVisible();
});
