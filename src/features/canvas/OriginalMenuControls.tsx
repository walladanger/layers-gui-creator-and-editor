import { createElement, Fragment, type ReactNode } from 'react';
import { Play, RotateCcw, X } from 'lucide-react';
import { originalMenuService, type OriginalControl } from '../../services/originalMenuService';

/** Render a strict, safe control description: never import scripts or HTML into the host. */
export function OriginalMenuControls({ controls }: { controls: OriginalControl[] }) {
  const render = (control: OriginalControl): ReactNode => {
    if (control.tag === 'text') return control.text;
    const a = control.attrs ?? {};
    const children = control.children?.map(child => <Fragment key={child.key}>{render(child)}</Fragment>);
    if (control.tag === 'input' || control.tag === 'textarea' || control.tag === 'select') {
      const props = { key: control.key, type: a.type, min: a.min, max: a.max, step: a.step, value: a.value ?? '', placeholder: a.placeholder, 'aria-label': a['aria-label'], autoFocus: control.tag === 'textarea' && (a['aria-label'] === 'Comment' || a['aria-label'] === 'Reply'), disabled: 'disabled' in a, readOnly: 'readonly' in a, onChange: (event: { target: { value: string } }) => originalMenuService.activate(control.key, event.target.value), onKeyDown: (event: { key: string; ctrlKey: boolean; metaKey: boolean; preventDefault(): void }) => { if (event.key === 'Escape' || event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); originalMenuService.keyDown(control.key, event); } } };
      return createElement(control.tag, props, control.tag === 'select' ? children : undefined);
    }
    if (control.tag === 'button') {
      const name = a['aria-label'] ?? a.title ?? '';
      const hasText = control.children?.some(c => c.tag === 'text' && c.text?.trim() || c.tag !== 'text');
      return <button type="button" key={control.key} disabled={'disabled' in a} role={a.role} aria-label={a['aria-label']} aria-pressed={a['aria-pressed'] === undefined ? undefined : a['aria-pressed'] === 'true'} aria-checked={a['aria-checked'] === undefined ? undefined : a['aria-checked'] === 'true'} title={a.title} onClick={() => originalMenuService.activate(control.key)}>
        {a.role === 'switch' ? <span className="original-switch" data-on={a['aria-checked'] === 'true'} /> : hasText ? children : name.startsWith('Play') ? <Play size={14} /> : name.startsWith('Delete') || name === 'Close' ? <X size={14} /> : <RotateCcw size={14} />}
      </button>;
    }
    if (control.tag === 'details') return <details key={control.key} open={a.open === 'true'}>{control.children?.map(child => child.tag === 'summary' ? <summary key={child.key} onClick={event => { event.preventDefault(); originalMenuService.activate(child.key); }}>{child.children?.map(render)}</summary> : render(child))}</details>;
    return createElement(control.tag, { key: control.key, className: `original-${control.tag}` }, children);
  };
  return <div className="original-controls">{controls.map(render)}</div>;
}