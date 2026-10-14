import { Check } from 'lucide-react';
import './taskTree.css';

export interface TaskNode { label: string; done?: boolean; children?: TaskNode[] }

const d = (label: string, children?: TaskNode[]): TaskNode => ({ label, done: true, children });

export const productionTasks: TaskNode[] = [
  d('Phase 0: Stabilize in-progress tasks', [d('Phase 4: User-friendly-first UI'), d('Phase 6: Hardening + verify/commit/PR')]),
  d('Phase 1: Duration & resolution abstraction', [d('Phase 2: Full-HD images (upscaler/hires)'), d('Phase 3: HD video 30s+'), d('Phase 5: Chat last-used settings popup')]),
  d('Task 31: TurboQuant ON by default (D41)'),
  d('T30-S05: submit retry'),
  d('T30-S05: job persistence'),
  d('T30-S06: builtin adapter honesty'),
  d('T30-S07: provider dropdown'),
  d('T30-S08: first image'),
  d('Building video frame extractor', [
    d('Adding Continue button to video assets'),
    d('Wiring last frame as init_image', [d('Adding continue-last-video in chat'), d('Surfacing end_image conditioning')]),
  ]),
  d('Adding image input to fal Wan A14B'),
  d('Adding image input to Replicate video model'),
  d('Recording video continuation decision'),
  d('Wire or remove orphaned stdout progress parser'),
  d('Verify SHA-256 after engine model extraction'),
  d('Fix engine port race and wait-on-stop'),
  d('Dedup shared param specs across adapters'),
  d('Verify, commit, and open PR'),
];

function Nodes({ nodes }: { nodes: TaskNode[] }) {
  return <ul className="task-tree__list">
    {nodes.map(node => <li key={node.label} className="task-tree__item">
      <div className="task-tree__row">
        <span className="task-tree__dot" data-done={node.done ? 'true' : 'false'} aria-label={node.done ? 'Done' : 'Open'}>
          {node.done && <Check size={10} strokeWidth={3.5} />}
        </span>
        <span>{node.label}</span>
      </div>
      {node.children && <Nodes nodes={node.children} />}
    </li>)}
  </ul>;
}

export function TaskTree({ title = 'Tasks', tasks = productionTasks }: { title?: string; tasks?: TaskNode[] }) {
  return <section className="task-tree" aria-label={title}>
    <h2 className="task-tree__title">{title}</h2>
    <Nodes nodes={tasks} />
  </section>;
}
