import type { ReactNode } from 'react';
import { PRODUCT_NAME } from '../../app/brand';
import type { ShellRoute } from '../../navigation/navigationTypes';
import { CanvasPage } from '../canvas/CanvasPage';
import { ProjectsPage } from '../projects/ProjectsPage';
import { TaskTree } from '../production/TaskTree';
import AgentWindow from '../agent/AgentWindow';
import '../canvas/canvas.css';

interface PageCopy { title: string; intro: string; emptyTitle: string; emptyText: string }

const copy: Record<Exclude<ShellRoute, 'canvas' | 'projects'>, PageCopy> = {
  production: { title: 'Production', intro: 'The list of changes for a coding agent to make.', emptyTitle: 'No production list yet', emptyText: 'Make changes on the canvas to build one.' },
  comments: { title: 'Comments', intro: 'Notes pinned to parts of your app.', emptyTitle: 'No comments yet', emptyText: 'Use the Comment tool on the canvas to add one.' },
  agents: { title: 'Agents', intro: 'Connect a live coding agent.', emptyTitle: 'No agents connected', emptyText: 'Choose a model server.' },
  settings: { title: 'Settings', intro: 'Use Appearance in the navigation to change the accent colour.', emptyTitle: 'More settings soon', emptyText: 'Account and project settings arrive with sign-in.' },
  about: { title: 'About', intro: `${PRODUCT_NAME} lets you change any app visually and hands the changes to a coding agent.`, emptyTitle: PRODUCT_NAME, emptyText: 'Version 0.1.0' },
};

export function RoutePage({ route }: { route: ShellRoute }) {
  if (route === 'canvas') return <CanvasPage />;
  if (route === 'projects') return <ProjectsPage />;
  if (route === 'agents') return <AgentWindow />;
  const page = copy[route];
  if (route === 'production') return (
    <section className="route-page" aria-labelledby="route-production" data-route="production">
      <h1 id="route-production">{page.title}</h1>
      <p className="editor-empty__text">{page.intro}</p>
      <TaskTree aiReview />
    </section>
  );
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
