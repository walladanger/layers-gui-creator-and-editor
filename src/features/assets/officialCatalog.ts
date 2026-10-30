import { SHADCN_ASSETS, type AssetEntry } from './catalog';

/** Official shadcn/ui component sidebar (October 2026).
 * Locally bundled components have an interactive demo and can be inserted.
 * All other official entries are discoverable with their documentation links,
 * but are deliberately not advertised as available for direct insertion.
 */
const officialComponents: Array<[string, string]> = [
  ['accordion', 'Accordion'], ['alert', 'Alert'], ['alert-dialog', 'Alert Dialog'],
  ['aspect-ratio', 'Aspect Ratio'], ['attachment', 'Attachment'], ['avatar', 'Avatar'],
  ['badge', 'Badge'], ['breadcrumb', 'Breadcrumb'], ['bubble', 'Bubble'],
  ['button', 'Button'], ['button-group', 'Button Group'], ['calendar', 'Calendar'],
  ['card', 'Card'], ['carousel', 'Carousel'], ['chart', 'Chart'],
  ['checkbox', 'Checkbox'], ['code-block', 'Code Block'], ['collapsible', 'Collapsible'],
  ['combobox', 'Combobox'], ['command', 'Command'], ['context-menu', 'Context Menu'],
  ['data-table', 'Data Table'], ['date-picker', 'Date Picker'], ['dialog', 'Dialog'],
  ['direction', 'Direction'], ['drawer', 'Drawer'], ['dropdown-menu', 'Dropdown Menu'],
  ['empty', 'Empty'], ['field', 'Field'], ['hover-card', 'Hover Card'],
  ['input', 'Input'], ['input-group', 'Input Group'], ['input-otp', 'Input OTP'],
  ['item', 'Item'], ['kbd', 'Kbd'], ['label', 'Label'], ['marker', 'Marker'],
  ['menubar', 'Menubar'], ['message', 'Message'], ['message-scroller', 'Message Scroller'],
  ['native-select', 'Native Select'], ['navigation-menu', 'Navigation Menu'],
  ['pagination', 'Pagination'], ['popover', 'Popover'], ['progress', 'Progress'],
  ['questionnaire', 'Questionnaire'], ['radio-group', 'Radio Group'],
  ['resizable', 'Resizable'], ['scroll-area', 'Scroll Area'], ['select', 'Select'],
  ['separator', 'Separator'], ['sheet', 'Sheet'], ['sidebar', 'Sidebar'],
  ['skeleton', 'Skeleton'], ['slider', 'Slider'], ['spinner', 'Spinner'],
  ['switch', 'Switch'], ['table', 'Table'], ['tabs', 'Tabs'],
  ['textarea', 'Textarea'], ['toast', 'Toast'], ['toggle', 'Toggle'],
  ['toggle-group', 'Toggle Group'], ['tooltip', 'Tooltip'], ['trace', 'Trace'],
  ['typography', 'Typography'],
];

const bundled = new Map(SHADCN_ASSETS.map((asset) => [asset.id, asset]));

/** Combined catalog: full shadcn/ui discovery, truthful local-preview support. */
export const COMPONENT_CATALOG: AssetEntry[] = officialComponents.map(([slug, name]) => {
  const id = `shadcn:${slug}`;
  const docsUrl = `https://ui.shadcn.com/docs/components/base/${slug}`;
  return bundled.get(id) ?? {
    id,
    library: 'shadcn',
    name,
    category: 'Documentation',
    description: `Explore the official ${name} component and installation instructions.`,
    importLine: '',
    usage: '',
    docsUrl,
    previewAvailable: false,
    keywords: ['official', 'shadcn', slug],
  };
});

export const previewableCount = SHADCN_ASSETS.length;
