import { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpDown, Blend, ChevronRight, Maximize2, Orbit, Sun, Waves, ChevronDown, ClipboardList, Palette, Sparkles, Wand2, Scan, Layers, Type, Paintbrush, RectangleHorizontal, CircleCheck, CircleDot, Droplets, Vibrate, Pencil, Focus, Code2, ListChecks, PanelsTopLeft } from 'lucide-react';
import { originalMenuService } from '../../services/originalMenuService';
import { OriginalMenuControls } from './OriginalMenuControls';
import { liveStyleService } from '../../services/liveStyleService';
import { LiveStyleControls } from './LiveStyleControls';

export interface RibbonTask { id: string; text: string }

export function CommandRibbon() {
  const live = useSyncExternalStore(liveStyleService.subscribe, liveStyleService.getSnapshot);
  const original = useSyncExternalStore(originalMenuService.subscribe, originalMenuService.getSnapshot);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [editorOpen, setEditorOpen] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const icons: Record<string, typeof Sparkles> = {
    presets: Wand2, edges: Scan, depth: Layers, spacing: Type, color: Palette,
    greens: CircleCheck, grad: Blend, burst: Sparkles, view: RectangleHorizontal,
    export: Code2, 'fx-chase': Orbit, 'fx-pulse': Sun, 'fx-warp': Waves,
    'fx-ripple': Droplets, 'fx-shimmer': Paintbrush, 'fx-pop': Maximize2, 'fx-shake': Vibrate,
    'fx-float': ArrowUpDown, 'fx-draw': Pencil, 'fx-enter': Focus, 'motion-actions': CircleDot,
    notes: ListChecks,
  };
  const fallbackSections = [
    ['presets', 'Presets'], ['edges', 'Corners and edges'],
    ['depth', 'Depth and glow'], ['spacing', 'Spacing and text'], ['color', 'Colour'],
    ['greens', 'Status greens'], ['grad', 'Background gradient'], ['burst', 'Page-change burst'],
    ['view', 'Card size and theme'], ['export', 'Your settings as CSS'],
    ['fx-chase', 'Edge chase'], ['fx-pulse', 'Glow pulse'], ['fx-warp', 'Warp'], ['fx-ripple', 'Ripple'],
    ['fx-shimmer', 'Shimmer'], ['fx-pop', 'Pop'], ['fx-shake', 'Shake'], ['fx-float', 'Float'],
    ['fx-draw', 'Border draw'], ['fx-enter', 'Blur-in entrance'], ['motion-actions', 'Motion actions'],
    ['notes', 'Comments and changes'],
  ].map(([id, label]) => ({ id, label, controls: [], actions: [] }));
  const sections = original.connected ? fallbackSections.map(fallback => original.sections.find(section => section.id === fallback.id) ?? fallback) : fallbackSections;
  const folders = [
    { id: 'appearance', label: 'Colours and appearance', icon: Palette, sections: ['color', 'greens', 'grad', 'depth'] },
    { id: 'layout', label: 'Layout and text', icon: RectangleHorizontal, sections: ['edges', 'spacing', 'view'] },
    { id: 'motion', label: 'Motion', icon: Orbit, sections: ['burst', 'fx-chase', 'fx-pulse', 'fx-warp', 'fx-ripple', 'fx-shimmer', 'fx-pop', 'fx-shake', 'fx-float', 'fx-draw', 'fx-enter', 'motion-actions'] },
    { id: 'output', label: 'Notes and export', icon: ClipboardList, sections: ['notes', 'export'] },
  ];
  const renderSection = (section: typeof sections[number]) => {
    const Icon = icons[section.id] ?? ClipboardList;
    const expanded = expandedSections[section.id] ?? false;
    return <section className="original-menu__section" key={section.id}>
      <div className="original-menu__row">
        <button type="button" className="menu-tree__button navigation__item" aria-expanded={expanded}
          aria-controls={`original-section-${section.id}`} onClick={() => { if (!expanded) originalMenuService.openSection(section.id); setExpandedSections(previous => ({ ...previous, [section.id]: !expanded })); }}>
          <Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{section.label}</span>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>
      {expanded && <div className="original-menu__expanded" id={`original-section-${section.id}`}>
        {original.connected ? <><OriginalMenuControls controls={section.actions} /><OriginalMenuControls controls={section.controls} /></> : <p className="ribbon__blurb">Open the Radium demo to adjust these settings.</p>}
      </div>}
    </section>;
  };
  const tree = <aside className="menu-tree original-menu" aria-label="Effect menu">
    <button type="button" className="menu-tree__button navigation__item original-menu__folder" aria-label="GUI Editor" aria-expanded={editorOpen}
      aria-controls="gui-editor-sections" onClick={() => setEditorOpen(open => !open)}>
      <PanelsTopLeft size={18} strokeWidth={1.8} aria-hidden="true" /><span>GUI Editor</span>
      {editorOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
    </button>
    <div id="gui-editor-sections" className="original-menu__folder-body" hidden={!editorOpen}>
    {sections.filter(section => section.id === 'presets').map(renderSection)}
    {folders.map(folder => {
      const expanded = expandedFolders[folder.id] ?? false;
      const Icon = folder.icon;
      return <div className="original-menu__category" key={folder.id}>
        <button type="button" className="menu-tree__button navigation__item original-menu__folder" aria-expanded={expanded}
          aria-controls={`gui-editor-folder-${folder.id}`} onClick={() => setExpandedFolders(previous => ({ ...previous, [folder.id]: !expanded }))}>
          <Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{folder.label}</span>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className="original-menu__folder-body original-menu__category-body" id={`gui-editor-folder-${folder.id}`} role="group" aria-label={folder.label} hidden={!expanded}>
          {folder.sections.flatMap(id => sections.filter(section => section.id === id)).map(renderSection)}
        </div>
      </div>;
    })}
    </div>
  </aside>;
  const leftSlot = document.getElementById('canvas-left-controls');
  if (live.connected) return <LiveStyleControls />;
  return <div className="ribbon" data-open="true" data-placement="left">
    <div className="ribbon__workspace" />
    {leftSlot ? createPortal(tree, leftSlot) : tree}
    {original.commentBox && createPortal(<div className="original-comment" role="dialog" aria-label={original.commentBox.label}>
      <OriginalMenuControls controls={original.commentBox.controls} />
    </div>, document.body)}
    {original.dialog && createPortal(<div className="original-dialog__backdrop" onClick={() => originalMenuService.answerDialog(false)}>
      <div className="original-dialog" role="alertdialog" aria-modal="true" aria-label={original.dialog.title} onClick={event => event.stopPropagation()}>
        <h3>{original.dialog.title}</h3><p>{original.dialog.text}</p>
        <div className="original-dialog__foot"><button type="button" autoFocus onClick={() => originalMenuService.answerDialog(false)}>Cancel</button>
          <button type="button" data-danger={original.dialog.danger} onClick={() => originalMenuService.answerDialog(true)}>{original.dialog.ok}</button></div>
      </div></div>, document.body)}
    {original.toast && createPortal(<div className="original-toast" role="status">{original.toast}</div>, document.body)}
  </div>;
}
