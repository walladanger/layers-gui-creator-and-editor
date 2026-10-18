import { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, SlidersHorizontal, Copy, Undo2, Redo2 } from 'lucide-react';
import { LIVE_STYLE_FIELDS, liveStyleService } from '../../services/liveStyleService';

function colorHex(value: string) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  const rgb = value.match(/[\d.]+/g);
  return rgb && rgb.length >= 3 ? '#' + rgb.slice(0, 3).map(n => Math.min(255, Math.round(Number(n))).toString(16).padStart(2, '0')).join('') : '#000000';
}
export function LiveStyleControls() {
  const state = useSyncExternalStore(liveStyleService.subscribe, liveStyleService.getSnapshot);
  const [expanded, setExpanded] = useState(true);
  const [copyStatus, setCopyStatus] = useState('');
  if (!state.connected) return null;
  const panel = <aside className="menu-tree original-menu live-style" aria-label="Live app styling">
    <button type="button" className="menu-tree__button navigation__item" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>
      <SlidersHorizontal size={18} /><span>Selected item</span>{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
    </button>
    {expanded && <div className="original-menu__expanded live-style__controls">
      {state.node ? <>
        <strong className="live-style__selection">{state.node.text || state.node.label}</strong>
        {state.node.instanceCount > 1 && <label>Apply to<select aria-label="Apply to" value={state.scope} onChange={e => liveStyleService.setScope(e.target.value as 'instance' | 'all')}><option value="instance">This one</option><option value="all">All {state.node.instanceCount} matching items</option></select></label>}
        {LIVE_STYLE_FIELDS.map(f => <label key={f.property}>{f.label}
          <input key={`${state.node?.nid}-${state.values[f.property]}`} aria-label={f.label} type={f.type} min={f.type === 'number' ? 0 : undefined} max={'max' in f ? f.max : undefined}
            defaultValue={f.type === 'color' ? colorHex(state.values[f.property] ?? '') : parseFloat(state.values[f.property] ?? '') || 0} disabled={state.busy}
            onBlur={e => { const value = e.currentTarget.value; if (f.type === 'number' && (!Number.isFinite(Number(value)) || Number(value) < 0 || ('max' in f && Number(value) > f.max))) return; void liveStyleService.edit(f.property, f.type === 'number' ? `${value}px` : value); }}
            onChange={e => { if (f.type === 'color') void liveStyleService.edit(f.property, e.target.value); }} />
        </label>)}
      </> : <p className="ribbon__blurb">No item selected</p>}
      <div className="live-style__actions">
        <button type="button" aria-label="Undo live style" title="Undo style" disabled={!state.canUndo || state.busy} onClick={() => void liveStyleService.undo()}><Undo2 size={16} /></button>
        <button type="button" aria-label="Redo live style" title="Redo style" disabled={!state.canRedo || state.busy} onClick={() => void liveStyleService.redo()}><Redo2 size={16} /></button>
        <button type="button" disabled={!state.count} onClick={async () => { try { await navigator.clipboard.writeText(liveStyleService.exportCss()); setCopyStatus('Copied'); } catch { setCopyStatus('Clipboard unavailable'); } }}><Copy size={16} />Copy CSS</button>
      </div>
      {state.error && <p role="alert">{state.error}</p>}{copyStatus && <p role="status">{copyStatus}</p>}
    </div>}
  </aside>;
  const slot = document.getElementById('canvas-left-controls');
  return slot ? createPortal(panel, slot) : panel;
}
