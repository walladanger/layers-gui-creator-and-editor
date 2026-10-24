import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp, X } from 'lucide-react';
import { helpFor } from './helpContent';

interface HoverTarget { key: string; ask: boolean; rect: DOMRect; labelRect: DOMRect | null }

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
    let target: HTMLElement | null = null;
    const measure = () => {
      if (!target?.isConnected) return;
      const el = target;
      const label = el.querySelector('span');
      let labelRect: DOMRect | null = null;
      if (label?.getClientRects().length && label.firstChild) {
        const range = document.createRange();
        range.selectNodeContents(label);
        const textRect = range.getBoundingClientRect();
        const box = label.getBoundingClientRect();
        // Leave the same small gap after text, without covering a chevron or shortcut.
        labelRect = new DOMRect(box.left, box.top, Math.max(0, Math.min(textRect.right, box.right - 23) - box.left), box.height);
      }
      setHover({ key: el.dataset.help ?? '', ask: el.hasAttribute('data-help-ask') && !!labelRect, rect: el.getBoundingClientRect(), labelRect });
    };
    const observer = new ResizeObserver(measure);
    const over = (event: MouseEvent) => {
      const el = (event.target as HTMLElement | null)?.closest?.('[data-help]') as HTMLElement | null;
      if (!el) return;
      const key = el.dataset.help ?? '';
      if (!helpFor(key) || key === hoverKey.current) return;
      hoverKey.current = key;
      observer.disconnect();
      target = el;
      observer.observe(el);
      measure();
      setTipReady(false);
      clearTipTimer();
      timer.current = window.setTimeout(() => setTipReady(true), 350);
    };
    const out = (event: MouseEvent) => {
      const to = event.relatedTarget as HTMLElement | null;
      if (to?.closest?.('[data-help], .help-ask')) return;
      hoverKey.current = null;
      target = null;
      observer.disconnect();
      setHover(null);
      setTipReady(false);
      clearTipTimer();
    };
    const scroll = () => { hoverKey.current = null; target = null; observer.disconnect(); setHover(null); setTipReady(false); clearTipTimer(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setPanel(null); };
    const down = (event: PointerEvent) => {
      if (!(event.target as HTMLElement | null)?.closest?.('.help-panel, .help-ask')) setPanel(null);
    };
    document.addEventListener('mouseover', over);
    document.addEventListener('mouseout', out);
    document.addEventListener('scroll', scroll, true);
    document.addEventListener('keydown', key);
    document.addEventListener('pointerdown', down);
    window.addEventListener('resize', measure);
    return () => {
      document.removeEventListener('mouseover', over);
      document.removeEventListener('mouseout', out);
      document.removeEventListener('scroll', scroll, true);
      document.removeEventListener('keydown', key);
      document.removeEventListener('pointerdown', down);
      window.removeEventListener('resize', measure);
      observer.disconnect();
      clearTipTimer();
    };
  }, []);

  const entry = hover ? helpFor(hover.key) : undefined;
  const panelEntry = panel ? helpFor(panel.key) : undefined;
  const TIP_WIDTH = 330;
  const PANEL_WIDTH = 640;
  const clampX = (x: number, width: number) => Math.max(8, Math.min(x, window.innerWidth - width - 8));
  const tipLeft = hover && hover.rect.right + 8 + TIP_WIDTH <= window.innerWidth
    ? hover.rect.right + 8
    : hover ? clampX(hover.rect.left, TIP_WIDTH) : 8;
  const tipTop = hover && hover.rect.right + 8 + TIP_WIDTH <= window.innerWidth
    ? Math.max(8, Math.min(hover.rect.top - 4, window.innerHeight - 120))
    : hover ? Math.min(hover.rect.bottom + 6, window.innerHeight - 120) : 8;
  const askAnchor = hover?.labelRect ?? hover?.rect ?? null;

  return createPortal(<>
    {hover && entry && tipReady && !panel && (
      <div className="help-tooltip" role="tooltip" style={{ left: tipLeft, top: tipTop }}>
        <b className="help-tooltip__title">{entry.title}</b>
        <span>{entry.tip}</span>
      </div>
    )}
    {hover && entry && hover.ask && askAnchor && (
      <button type="button" className="help-ask" aria-label={`More about ${entry.title}`}
        style={{ left: askAnchor.right + 5, top: hover.rect.top + hover.rect.height / 2, transform: 'translateY(-50%)' }}
        onClick={() => { setPanel(hover); setHover(null); setTipReady(false); }}>
        <CircleHelp size={14} aria-hidden="true" />
      </button>
    )}
    {panel && panelEntry && (
      <div className="help-panel" role="dialog" aria-label={panelEntry.title}
        style={{ left: clampX(panel.rect.right + 8, PANEL_WIDTH), top: Math.max(8, Math.min(panel.rect.top - 8, window.innerHeight - 320)) }}>
        <div className="help-panel__head">
          <b>{panelEntry.title}</b>
          <button type="button" aria-label="Close help" onClick={() => setPanel(null)}><X size={16} aria-hidden="true" /></button>
        </div>
        <p>{panelEntry.body}</p>
      </div>
    )}
  </>, document.body);
}
