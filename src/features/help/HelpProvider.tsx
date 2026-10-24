import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp, X } from 'lucide-react';
import { helpFor } from './helpContent';

interface HoverTarget { key: string; ask: boolean; rect: DOMRect }

/**
 * Global hover help: any element with data-help="key" gets a tooltip card;
 * elements also carrying data-help-ask reveal a small "?" button that opens
 * a verbose panel. One provider watches the whole document so buttons only
 * need attributes, never wrappers.
 */
export function HelpProvider() {
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const [tipReady, setTipReady] = useState(false);
  const [panel, setPanel] = useState<HoverTarget | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const hoverKey = useRef<string | null>(null);

  useEffect(() => {
    const clearTipTimer = () => window.clearTimeout(timer.current);
    const over = (event: MouseEvent) => {
      const el = (event.target as HTMLElement | null)?.closest?.('[data-help]') as HTMLElement | null;
      if (!el) return;
      const key = el.dataset.help ?? '';
      if (!helpFor(key) || key === hoverKey.current) return;
      hoverKey.current = key;
      setHover({ key, ask: el.hasAttribute('data-help-ask'), rect: el.getBoundingClientRect() });
      setTipReady(false);
      clearTipTimer();
      timer.current = window.setTimeout(() => setTipReady(true), 350);
    };
    const out = (event: MouseEvent) => {
      const to = event.relatedTarget as HTMLElement | null;
      if (to?.closest?.('[data-help], .help-ask')) return;
      hoverKey.current = null;
      setHover(null);
      setTipReady(false);
      clearTipTimer();
    };
    const scroll = () => { hoverKey.current = null; setHover(null); setTipReady(false); clearTipTimer(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setPanel(null); };
    const down = (event: PointerEvent) => {
      if (!(event.target as HTMLElement | null)?.closest?.('.help-panel, .help-ask')) setPanel(null);
    };
    document.addEventListener('mouseover', over);
    document.addEventListener('mouseout', out);
    document.addEventListener('scroll', scroll, true);
    document.addEventListener('keydown', key);
    document.addEventListener('pointerdown', down);
    return () => {
      document.removeEventListener('mouseover', over);
      document.removeEventListener('mouseout', out);
      document.removeEventListener('scroll', scroll, true);
      document.removeEventListener('keydown', key);
      document.removeEventListener('pointerdown', down);
      clearTipTimer();
    };
  }, []);

  const entry = hover ? helpFor(hover.key) : undefined;
  const panelEntry = panel ? helpFor(panel.key) : undefined;
  const clampX = (x: number, width: number) => Math.max(8, Math.min(x, window.innerWidth - width - 8));

  return createPortal(<>
    {hover && entry && tipReady && !panel && (
      <div className="help-tooltip" role="tooltip"
        style={{ left: clampX(hover.rect.left, 260), top: Math.min(hover.rect.bottom + 6, window.innerHeight - 60) }}>
        {entry.tip}
      </div>
    )}
    {hover && entry && hover.ask && (
      <button type="button" className="help-ask" aria-label={`More about ${entry.title}`}
        style={{ left: hover.rect.right - 12, top: Math.max(hover.rect.top - 8, 4) }}
        onClick={() => { setPanel(hover); setHover(null); setTipReady(false); }}>
        <CircleHelp size={15} aria-hidden="true" />
      </button>
    )}
    {panel && panelEntry && (
      <div className="help-panel" role="dialog" aria-label={panelEntry.title}
        style={{ left: clampX(panel.rect.right + 8, 330), top: Math.max(8, Math.min(panel.rect.top - 8, window.innerHeight - 220)) }}>
        <div className="help-panel__head">
          <b>{panelEntry.title}</b>
          <button type="button" aria-label="Close help" onClick={() => setPanel(null)}><X size={14} aria-hidden="true" /></button>
        </div>
        <p>{panelEntry.body}</p>
      </div>
    )}
  </>, document.body);
}
