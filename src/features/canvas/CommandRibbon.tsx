import { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpDown, Blend, ChevronRight, Maximize2, Orbit, Sun, Waves, ChevronDown, ClipboardList, Palette, Sparkles, Wand2, Scan, Layers, Type, Paintbrush, RectangleHorizontal, CircleCheck, CircleDot, Droplets, MoveHorizontal, Triangle, Vibrate, Pencil, Focus, Save, Code2, MousePointer2, RotateCcw, ListChecks } from 'lucide-react';
import { originalMenuService } from '../../services/originalMenuService';
import { OriginalMenuControls } from './OriginalMenuControls';

export interface RibbonTask { id: string; text: string }

export function CommandRibbon() {
  const original = useSyncExternalStore(originalMenuService.subscribe, originalMenuService.getSnapshot);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const icons: Record<string, typeof Sparkles> = {
    saved: Save, presets: Wand2, edges: Scan, depth: Layers, spacing: Type, color: Palette,
    greens: CircleCheck, grad: Blend, burst: Sparkles, view: RectangleHorizontal, try: Triangle,
    export: Code2, inspector: MousePointer2, 'fx-chase': Orbit, 'fx-pulse': Sun, 'fx-warp': Waves,
    'fx-ripple': Droplets, 'fx-shimmer': Paintbrush, 'fx-pop': Maximize2, 'fx-shake': Vibrate,
    'fx-float': ArrowUpDown, 'fx-draw': Pencil, 'fx-enter': Focus, 'motion-actions': CircleDot,
    reset: RotateCcw, tools: MoveHorizontal, notes: ListChecks,
  };
  const fallbackSections = [
    ['saved', 'Saved looks'], ['presets', 'Presets'], ['edges', 'Corners and edges'],
    ['depth', 'Depth and glow'], ['spacing', 'Spacing and text'], ['color', 'Colour'],
    ['greens', 'Status greens'], ['grad', 'Background gradient'], ['burst', 'Page-change burst'],
    ['view', 'Card size and theme'], ['try', 'Try it'], ['export', 'Your settings as CSS'],
    ['fx-chase', 'Edge chase'], ['fx-pulse', 'Glow pulse'], ['fx-warp', 'Warp'], ['fx-ripple', 'Ripple'],
    ['fx-shimmer', 'Shimmer'], ['fx-pop', 'Pop'], ['fx-shake', 'Shake'], ['fx-float', 'Float'],
    ['fx-draw', 'Border draw'], ['fx-enter', 'Blur-in entrance'], ['motion-actions', 'Motion actions'],
    ['reset', 'Reset to original'], ['tools', 'Edit tools'],
  ].map(([id, label]) => ({ id, label, controls: [], actions: [] }));
  const tree = <aside className="menu-tree original-menu" aria-label="Effect menu">
    {(original.connected ? original.sections : fallbackSections).map(section => {
      const Icon = icons[section.id] ?? ClipboardList;
      const expanded = expandedSections[section.id] ?? false;
      return <section className="original-menu__section" key={section.id}>
        <div className="original-menu__row">
          <button type="button" className="menu-tree__button navigation__item" aria-expanded={expanded}
            aria-controls={`original-section-${section.id}`} onClick={() => setExpandedSections(previous => ({ ...previous, [section.id]: !expanded }))}>
            <Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{section.label}</span>
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
        {expanded && <div className="original-menu__expanded" id={`original-section-${section.id}`}>
          {original.connected ? <><OriginalMenuControls controls={section.actions} /><OriginalMenuControls controls={section.controls} /></> : <p className="ribbon__blurb">Open the Radium demo to adjust these settings.</p>}
        </div>}
      </section>;
    })}
  </aside>;
  const leftSlot = document.getElementById('canvas-left-controls');
  return <div className="ribbon" data-open="true" data-placement="left">
    <div className="ribbon__workspace" />
    {leftSlot ? createPortal(tree, leftSlot) : tree}
  </div>;
}
