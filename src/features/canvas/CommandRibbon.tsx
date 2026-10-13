import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRightToLine, ArrowUpDown, Blend, ChevronRight, FoldVertical, Maximize2, Orbit, Sun, Waves, PanelLeft, PanelTop, ChevronDown, ChevronUp, ClipboardList, Copy, Palette, Sparkles, SquareStack, Trash2, Wand2, Scan, Layers, Type, Paintbrush, RectangleHorizontal, CircleCheck, CircleDot, Droplets, MoveHorizontal, PaintBucket, Triangle, Vibrate, Pencil, Focus, Save, Code2, MousePointer2, RotateCcw, ListChecks }  from 'lucide-react';
import { PageEditControls, type PageEditSection } from './PageEditControls';
import { originalMenuService } from '../../services/originalMenuService';
import { OriginalMenuControls } from './OriginalMenuControls';

/**
 * Office-style command ribbon (demo). Tabs hold grouped, plain-language controls so effects and
 * styling live above the canvas instead of floating over the app. Picks are staged as numbered
 * tasks for the Agent Tasks sheet; nothing is written to the backend yet.
 */
type TabId = 'effects' | 'transitions' | 'looks' | 'style' | 'tasks' | 'edit';

interface Param { key: string; label: string; min: number; max: number; step: number; unit: string; value: number }
interface Effect { id: string; name: string; blurb: string; trigger: string; params: Param[] }

const effects: Effect[] = [
  { id: 'chase', name: 'Edge chase', blurb: 'A light runs around the edge.', trigger: 'Click', params: [
    { key: 'speed', label: 'Lap time', min: 0.3, max: 4, step: 0.1, unit: 's', value: 1.1 },
    { key: 'glow', label: 'Glow', min: 0, max: 30, step: 1, unit: 'px', value: 10 }] },
  { id: 'pulse', name: 'Glow pulse', blurb: 'The edge glows, then settles.', trigger: 'Click', params: [
    { key: 'speed', label: 'Pulse time', min: 0.3, max: 4, step: 0.1, unit: 's', value: 1.4 },
    { key: 'glow', label: 'Brightness', min: 0, max: 40, step: 1, unit: 'px', value: 18 }] },
  { id: 'warp', name: 'Warp', blurb: 'A springy stretch that wobbles back.', trigger: 'Click', params: [
    { key: 'speed', label: 'Wobble time', min: 0.2, max: 2, step: 0.1, unit: 's', value: 0.7 },
    { key: 'glow', label: 'Stretch', min: 0, max: 20, step: 1, unit: '°', value: 8 }] },
  { id: 'float', name: 'Float', blurb: 'Gently bobs up and down.', trigger: 'Always', params: [
    { key: 'speed', label: 'Bob time', min: 1, max: 6, step: 0.5, unit: 's', value: 3 },
    { key: 'glow', label: 'Height', min: 0, max: 12, step: 1, unit: 'px', value: 4 }] },
];

const transitions = [
  { id: 'slide', name: 'Slide in', blurb: 'Panels slide in from the side.' },
  { id: 'fade', name: 'Cross-fade', blurb: 'Old fades out as new fades in.' },
  { id: 'pop', name: 'Pop', blurb: 'Grows from small with a bounce.' },
  { id: 'fold', name: 'Fold open', blurb: 'Opens like an accordion.' },
];

const looks = [
  { id: 'neon', name: 'Neon', colors: ['#0b0f14', '#3ddc97', '#8fb3ff'] },
  { id: 'glass', name: 'Frosted glass', colors: ['#1c2330', '#cfd8e3', '#7aa2f7'] },
  { id: 'minimal', name: 'Minimal', colors: ['#f4f4f2', '#1d1d1f', '#9a9a9a'] },
  { id: 'oled', name: 'Pure black', colors: ['#000000', '#ffffff', '#ff6b3d'] },
  { id: 'warm', name: 'Warm studio', colors: ['#2a1f1a', '#f2c98b', '#e2725b'] },
];

const tabs: { id: TabId; label: string; Icon: typeof Sparkles }[] = [
  { id: 'effects', label: 'Effects', Icon: Sparkles },
  { id: 'transitions', label: 'Transitions', Icon: SquareStack },
  { id: 'looks', label: 'Looks', Icon: Palette },
  { id: 'style', label: 'Corners & glow', Icon: Wand2 },
  { id: 'edit', label: 'Page edit', Icon: Paintbrush },
  { id: 'tasks', label: 'Agent tasks', Icon: ClipboardList },
];

const treeGroups: { id: string; label: string; Icon: typeof Sparkles; items: { tab: TabId; id: string; name: string; Icon: typeof Sparkles }[] }[] = [
  { id: 'motion', label: 'Motion', Icon: Sparkles, items: [
    { tab: 'effects', id: 'chase', name: 'Edge chase', Icon: Orbit },
    { tab: 'effects', id: 'pulse', name: 'Glow pulse', Icon: Sun },
    { tab: 'effects', id: 'warp', name: 'Warp', Icon: Waves },
    { tab: 'effects', id: 'float', name: 'Float', Icon: ArrowUpDown },
  ] },
  { id: 'transitions', label: 'Transitions', Icon: SquareStack, items: [
    { tab: 'transitions', id: 'slide', name: 'Slide in', Icon: ArrowRightToLine },
    { tab: 'transitions', id: 'fade', name: 'Cross-fade', Icon: Blend },
    { tab: 'transitions', id: 'pop', name: 'Pop', Icon: Maximize2 },
    { tab: 'transitions', id: 'fold', name: 'Fold open', Icon: FoldVertical },
  ] },
  { id: 'edit', label: 'Page edit', Icon: Wand2, items: [
    { tab: 'edit', id: 'presets', name: 'Presets', Icon: Wand2 },
    { tab: 'edit', id: 'edges', name: 'Corners and edges', Icon: Scan },
    { tab: 'edit', id: 'depth', name: 'Depth and glow', Icon: Layers },
    { tab: 'edit', id: 'spacing', name: 'Spacing and text', Icon: Type },
    { tab: 'edit', id: 'colour', name: 'Colour', Icon: Palette },
    { tab: 'edit', id: 'gradient', name: 'Background gradient', Icon: Blend },
    { tab: 'edit', id: 'burst', name: 'Page-change burst', Icon: Sparkles },
    { tab: 'edit', id: 'theme', name: 'Card size and theme', Icon: RectangleHorizontal, CircleCheck, CircleDot, Droplets, MoveHorizontal, PaintBucket, Triangle, Vibrate, Pencil, Focus, Save, Code2, MousePointer2, RotateCcw, ListChecks } ,
    { tab: 'tasks', id: 'tasks', name: 'Agent tasks', Icon: ClipboardList },
  ] },
];

export interface RibbonTask { id: string; text: string }

export function CommandRibbon() {
  const [tab, setTab] = useState<TabId>('effects');
  const [open, setOpen] = useState(true);
  const [placement, setPlacement] = useState<'top' | 'left'>('left')
  const original = useSyncExternalStore(originalMenuService.subscribe, originalMenuService.getSnapshot);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ edit: true });
  const [picked, setPicked] = useState<Record<TabId, string>>({ effects: 'chase', transitions: 'slide', looks: 'neon', style: 'style', tasks: 'tasks', edit: 'presets' });
  const [values, setValues] = useState<Record<string, Record<string, number>>>(() =>
    Object.fromEntries(effects.map((e) => [e.id, Object.fromEntries(e.params.map((p) => [p.key, p.value]))])));
  const [style, setStyle] = useState({ radius: 12, border: 1, glow: 0 });
  const [tasks, setTasks] = useState<RibbonTask[]>([]);
  const [replay, setReplay] = useState(0);

  const addTask = (text: string) => setTasks((t) => [...t, { id: crypto.randomUUID(), text }]);
  const markdown = tasks.map((t, i) => `${i + 1}. ${t.text}`).join('\n');
  const editSection = treeGroups.find(group => group.id === 'edit')?.items.find(item => item.tab === 'edit' && item.id === picked.edit);
  const editControls = <PageEditControls section={(editSection?.id ?? 'presets') as PageEditSection} onAddTask={addTask} />;

  const menu = (
      <div className="ribbon__tabs" role="tablist" aria-label="Ribbon">
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} role="tab" type="button" aria-selected={tab === id}
            onClick={() => { setTab(id); setOpen(true); }}>
            <Icon size={14} aria-hidden="true" /><span>{label}</span>
            {id === 'tasks' && tasks.length ? <span className="ribbon__count">{tasks.length}</span> : null}
          </button>
        ))}
        <button type="button" className="ribbon__collapse" aria-label={open ? 'Hide ribbon' : 'Show ribbon'} onClick={() => setOpen(!open)}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
  );

  const controls = open ? (
        <div className="ribbon__body" data-placement={placement} role="tabpanel" aria-label="Selected controls">
           <div className="ribbon__control-heading"><strong>{tab === 'edit' ? editSection?.name : tab === 'effects' ? effects.find(e => e.id === picked.effects)?.name : tab === 'transitions' ? transitions.find(t => t.id === picked.transitions)?.name : tabs.find(t => t.id === tab)?.label}</strong></div>
           <div hidden={tab !== 'edit'} className="ribbon__edit-controls">{editControls}</div>
          {tab === 'effects' && effects.filter(e => e.id === picked.effects).map((e) => (
            <section key={e.id} className="ribbon__group" aria-label={e.name}>
              <div className="ribbon__preview" key={replay}>
                <span className={`fx-demo fx-demo--${e.id}`} style={{ ['--fx-t' as string]: `${values[e.id].speed}s`, ['--fx-g' as string]: `${values[e.id].glow}` }}>Button</span>
              </div>
              <p className="ribbon__blurb">{e.blurb}</p>
              {e.params.map((p) => (
                <label key={p.key} className="ribbon__slider">
                  <span>{p.label}</span>
                  <input type="range" min={p.min} max={p.max} step={p.step} value={values[e.id][p.key]}
                    onChange={(ev) => setValues((v) => ({ ...v, [e.id]: { ...v[e.id], [p.key]: Number(ev.target.value) } }))} />
                  <output>{values[e.id][p.key]}{p.unit}</output>
                </label>
              ))}
              <div className="ribbon__actions">
                <button type="button" onClick={() => setReplay((n) => n + 1)}>Play</button>
                <button type="button" onClick={() => addTask(`Add "${e.name}" on ${e.trigger.toLowerCase()} — ${e.params.map((p) => `${p.label.toLowerCase()} ${values[e.id][p.key]}${p.unit}`).join(', ')}`)}>Add to tasks</button>
              </div>
              <h3 className="ribbon__label">{e.name}</h3>
            </section>
          ))}

          {tab === 'transitions' && transitions.filter(t => t.id === picked.transitions).map((t) => (
            <section key={t.id} className="ribbon__group" aria-label={t.name}>
              <div className="ribbon__preview" key={replay}><span className={`tx-demo tx-demo--${t.id}`} /></div>
              <p className="ribbon__blurb">{t.blurb}</p>
              <div className="ribbon__actions">
                <button type="button" onClick={() => setReplay((n) => n + 1)}>Play</button>
                <button type="button" onClick={() => addTask(`Use the "${t.name}" transition when this panel opens`)}>Add to tasks</button>
              </div>
              <h3 className="ribbon__label">{t.name}</h3>
            </section>
          ))}

          {tab === 'looks' && looks.filter(l => l.id === picked.looks).map((l) => (
            <section key={l.id} className="ribbon__group ribbon__group--narrow" aria-label={l.name}>
              <button type="button" className="ribbon__look" onClick={() => addTask(`Apply the "${l.name}" look (${l.colors.join(', ')})`)}>
                <span className="ribbon__swatches">{l.colors.map((c) => <i key={c} style={{ background: c }} />)}</span>
                <span>Apply</span>
              </button>
              <h3 className="ribbon__label">{l.name}</h3>
            </section>
          ))}

          {tab === 'style' && (
            <>
              <section className="ribbon__group" aria-label="Corners">
                <div className="ribbon__preview">
                  <span className="style-demo" style={{ borderRadius: style.radius, borderWidth: style.border, boxShadow: `0 0 ${style.glow}px var(--accent)` }} />
                </div>
                {([['radius', 'Roundness', 0, 32, 'px'], ['border', 'Edge thickness', 0, 6, 'px'], ['glow', 'Glow', 0, 30, 'px']] as const).map(([k, label, min, max, unit]) => (
                  <label key={k} className="ribbon__slider">
                    <span>{label}</span>
                    <input type="range" min={min} max={max} value={style[k]} onChange={(ev) => setStyle((s) => ({ ...s, [k]: Number(ev.target.value) }))} />
                    <output>{style[k]}{unit}</output>
                  </label>
                ))}
                <div className="ribbon__actions">
                  <button type="button" onClick={() => addTask(`Set roundness ${style.radius}px, edge ${style.border}px, glow ${style.glow}px`)}>Add to tasks</button>
                </div>
                <h3 className="ribbon__label">Corners & glow</h3>
              </section>
            </>
          )}

          {tab === 'tasks' && (
            <section className="ribbon__group ribbon__group--wide" aria-label="Agent tasks">
              {tasks.length === 0 ? <p className="ribbon__blurb">No tasks yet. Pick "Add to tasks" on any effect, look or style.</p> : (
                <ol className="ribbon__tasks">
                  {tasks.map((t) => (
                    <li key={t.id}><span>{t.text}</span>
                      <button type="button" aria-label="Remove task" onClick={() => setTasks((all) => all.filter((x) => x.id !== t.id))}><Trash2 size={12} /></button>
                    </li>
                  ))}
                </ol>
              )}
              <div className="ribbon__actions">
                <button type="button" disabled={!tasks.length} onClick={() => void navigator.clipboard?.writeText(markdown)}><Copy size={12} /> Copy for agent</button>
              </div>
              <h3 className="ribbon__label">Numbered task sheet</h3>
            </section>
          )}
        </div>
      ) : null;
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
  const titleSlot = document.getElementById('canvas-command-menu');
  const leftSlot = document.getElementById('canvas-left-controls');
   const choices = tab === 'effects' ? effects : tab === 'transitions' ? transitions : tab === 'looks' ? looks : tab === 'edit' ? treeGroups.flatMap(group => group.items).filter(item => item.tab === 'edit') : [{ id: tab, name: tab === 'style' ? 'Corners & glow' : 'Numbered task sheet' }];
   return <div className="ribbon" data-open="true" data-placement="left">
      <div className="ribbon__workspace" />
      {leftSlot ? createPortal(tree, leftSlot) : tree}
    </div>;
}
