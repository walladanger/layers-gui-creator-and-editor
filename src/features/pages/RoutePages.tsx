import type { ReactNode } from 'react';
import { PRODUCT_NAME } from '../../app/brand';
import type { ShellRoute } from '../../navigation/navigationTypes';
import { CanvasPage } from '../canvas/CanvasPage';
import '../canvas/canvas.css';

interface PageCopy { title: string; intro: string; emptyTitle: string; emptyText: string }

const copy: Record<Exclude<ShellRoute, 'canvas'>, PageCopy> = {
  projects: { title: 'Projects', intro: 'Each project points at one app you are building.', emptyTitle: 'No projects yet', emptyText: 'Projects arrive with sign-in in the next update.' },
  production: { title: 'Production', intro: 'The list of changes for a coding agent to make.', emptyTitle: 'No production list yet', emptyText: 'Make changes on the canvas to build one.' },
  comments: { title: 'Comments', intro: 'Notes pinned to parts of your app.', emptyTitle: 'No comments yet', emptyText: 'Use the Comment tool on the canvas to add one.' },
  'design-system': { title: 'Design system', intro: 'Colours, corners, spacing and motion for your app.', emptyTitle: 'No design tokens yet', emptyText: 'Connect an app to read its tokens.' },
  agents: { title: 'Agents', intro: 'Coding agents that read and finish your production list.', emptyTitle: 'No agents connected', emptyText: 'Agent access arrives in a later update.' },
  settings: { title: 'Settings', intro: 'Use Appearance in the navigation to change the accent colour.', emptyTitle: 'More settings soon', emptyText: 'Account and project settings arrive with sign-in.' },
  about: { title: 'About', intro: `${PRODUCT_NAME} lets you change any app visually and hands the changes to a coding agent.`, emptyTitle: 'Built on Ember Studio', emptyText: 'Version 0.1.0' },
};

export function RoutePage({ route }: { route: ShellRoute }) {
  if (route === 'canvas') return <CanvasPage />;
  const page = copy[route];
  return (
    <section className="route-page" aria-labelledby={`route-${route}`} data-route={route}>
      <h1 id={`route-${route}`}>{page.title}</h1>
      <p className="editor-empty__text">{page.intro}</p>
      <div className="editor-empty">
        <p className="editor-empty__title">{page.emptyTitle}</p>
        <p className="editor-empty__text">{page.emptyText}</p>
      </div>
    </section>
  );
}

export function renderRoute(route: ShellRoute): ReactNode {
  return <RoutePage route={route} />;
}
