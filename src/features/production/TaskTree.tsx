import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { useTaskTracker, type TaskNode } from '../../services/taskTracker';
import './taskTree.css';

interface RowProps {
  node: TaskNode;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  toggle: (id: string) => void;
  rename: (id: string, label: string) => void;
  remove: (id: string) => void;
  add: (parentId: string | null, label: string) => string;
}

function countDescendants(node: TaskNode): number {
  return node.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0);
}

function Row({ node, editingId, setEditingId, toggle, rename, remove, add }: RowProps) {
  const [draft, setDraft] = useState(node.label);
  const editing = editingId === node.id;

  const commit = () => {
    rename(node.id, draft);
    setEditingId(null);
  };

  const onDelete = () => {
    const kids = countDescendants(node);
    const message = kids > 0
      ? `Delete "${node.label}" and its ${kids} sub-task${kids === 1 ? '' : 's'}?`
      : `Delete "${node.label}"?`;
    if (window.confirm(message)) remove(node.id);
  };

  const onAddChild = () => {
    const newId = add(node.id, 'New task');
    setEditingId(newId);
  };

  return <li className="task-tree__item">
    <div className="task-tree__row">
      <button
        type="button"
        className="task-tree__dot"
        data-done={node.done ? 'true' : 'false'}
        aria-pressed={node.done}
        aria-label={node.done ? `Mark "${node.label}" as not done` : `Mark "${node.label}" as done`}
        onClick={() => toggle(node.id)}
      >
        {node.done && <Check size={10} strokeWidth={3.5} />}
      </button>
      {editing
        ? <input
            className="task-tree__input"
            value={draft}
            autoFocus
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') { setDraft(node.label); setEditingId(null); }
            }}
          />
        : <span
            className="task-tree__label"
            title="Double-click to rename"
            onDoubleClick={() => { setDraft(node.label); setEditingId(node.id); }}
          >{node.label}</span>}
      <span className="task-tree__controls">
        <button type="button" className="task-tree__icon-btn" aria-label={`Add a sub-task under "${node.label}"`} onClick={onAddChild}>
          <Plus size={12} strokeWidth={2.5} />
        </button>
        <button type="button" className="task-tree__icon-btn" aria-label={`Delete "${node.label}"`} onClick={onDelete}>
          <X size={12} strokeWidth={2.5} />
        </button>
      </span>
    </div>
    {node.children.length > 0 && <ul className="task-tree__list">
      {node.children.map(child => <Row key={child.id} node={child} editingId={editingId} setEditingId={setEditingId} toggle={toggle} rename={rename} remove={remove} add={add} />)}
    </ul>}
  </li>;
}

export function TaskTree({ title = 'Tasks' }: { title?: string }) {
  const { tasks, toggle, rename, remove, add } = useTaskTracker();
  const [editingId, setEditingId] = useState<string | null>(null);

  const onAddTop = () => {
    const newId = add(null, 'New task');
    setEditingId(newId);
  };

  return <section className="task-tree" aria-label={title}>
    <h2 className="task-tree__title">{title}</h2>
    <ul className="task-tree__list">
      {tasks.map(node => <Row key={node.id} node={node} editingId={editingId} setEditingId={setEditingId} toggle={toggle} rename={rename} remove={remove} add={add} />)}
    </ul>
    <button type="button" className="task-tree__add" onClick={onAddTop}>
      <Plus size={12} strokeWidth={2.5} /> Add task
    </button>
  </section>;
}
