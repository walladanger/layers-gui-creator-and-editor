// Turns a rendered component into the plain tree the bridge's `preview.insert` builds from.
// Computed styles are copied inline (only where they differ from a bare element of the same
// tag), so the preview looks right in any app, with or without Tailwind or shadcn's theme.

export interface InsertNode { t: string; a?: Record<string, string>; s?: string; c?: Array<InsertNode | string> }

const ATTRS = ['role', 'type', 'placeholder', 'value', 'disabled', 'checked', 'for', 'name', 'alt', 'title', 'tabindex', 'data-state',
  'aria-label', 'aria-hidden', 'aria-checked', 'aria-selected', 'aria-expanded', 'aria-pressed', 'aria-disabled', 'aria-orientation', 'aria-valuenow', 'aria-valuemin', 'aria-valuemax',
  'viewBox', 'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'width', 'height'];
/** Properties that only matter for interaction or motion, or repeat a physical property. */
const SKIP = /^(transition|animation|will-change|cursor|pointer-events|user-select|-webkit-|caret|outline|view-transition|anchor|position-anchor|position-try|interpolate|scroll|overscroll|touch-action|content-visibility|contain|perspective-origin|transform-origin|inset-|margin-(block|inline)|padding-(block|inline)|border-(block|inline)|border-(start|end)-|(min-|max-)?(block|inline)-size|text-decoration-|column-rule|offset|mask|app-region|field-sizing|counter|quotes|tab-size|hyphen|text-size-adjust|ruby|math-|speak|zoom)/;
const SIZE = /^(width|height|min-width|min-height|max-width|max-height)$/;
/** Inherited text properties set on the root, because the target app's page would otherwise supply them. */
const ROOT_TEXT = ['color', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-align', 'white-space'];
const SVG_NS = 'http://www.w3.org/2000/svg';
const HTML_TAGS = new Set(['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'label', 'input', 'textarea', 'select', 'option', 'ul', 'ol', 'li', 'section', 'article', 'header', 'footer', 'nav', 'main', 'aside', 'strong', 'em', 'b', 'i', 'small', 'code', 'pre', 'hr', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'form', 'fieldset', 'legend']);
const SVG_TAGS = new Set(['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'g']);

/** Elements whose size comes from their own classes or attributes keep it; others size to their new place. */
function keepsSize(el: Element) {
  if (el.namespaceURI === SVG_NS) return true;
  const cls = el.getAttribute('class') ?? '';
  return /(^|\s)(size|w|h|min-w|min-h|max-w|max-h)-/.test(cls);
}

export function snapshotElement(root: Element, maxNodes = 1500): InsertNode | null {
  const view = root.ownerDocument.defaultView;
  if (!view) return null;
  // Defaults come from a blank page with only the browser's own styles, not the preview page's
  // CSS reset, so anything the reset changes (border style, box sizing, margins) is copied too.
  const sandbox = root.ownerDocument.createElement('iframe');
  sandbox.style.cssText = 'position:absolute;left:-99999px;top:0;width:10px;height:10px;visibility:hidden';
  root.ownerDocument.body.appendChild(sandbox);
  const blank = sandbox.contentDocument;
  const blankView = sandbox.contentWindow;
  if (!blank?.body || !blankView) { sandbox.remove(); return null; }
  const defaults = new Map<string, CSSStyleDeclaration>();
  const defaultFor = (el: Element) => {
    const key = `${el.namespaceURI}|${el.localName}`;
    let cs = defaults.get(key);
    if (!cs) {
      const bare = el.namespaceURI === SVG_NS ? blank.createElementNS(SVG_NS, el.localName) : blank.createElement(el.localName);
      if (el.namespaceURI === SVG_NS && el.localName !== 'svg') { const holder = blank.createElementNS(SVG_NS, 'svg'); holder.appendChild(bare); blank.body.appendChild(holder); }
      else blank.body.appendChild(bare);
      cs = blankView.getComputedStyle(bare);
      defaults.set(key, cs);
    }
    return cs;
  };
  let left = maxNodes;
  const walk = (el: Element, isRoot: boolean): InsertNode | null => {
    if (left-- <= 0) return null;
    const tag = el.localName;
    if (!(el.namespaceURI === SVG_NS ? SVG_TAGS : HTML_TAGS).has(tag)) return null;
    const cs = view.getComputedStyle(el);
    if (cs.display === 'none') return null;
    const base = defaultFor(el);
    const sized = keepsSize(el);
    const styles: string[] = [];
    for (let i = 0; i < cs.length; i += 1) {
      const prop = cs[i];
      if (SKIP.test(prop) || (SIZE.test(prop) && !sized)) continue;
      const value = cs.getPropertyValue(prop);
      if (value && (value !== base.getPropertyValue(prop) || (isRoot && ROOT_TEXT.includes(prop)))) styles.push(`${prop}:${value}`);
    }
    if (isRoot) for (const prop of ROOT_TEXT) if (!styles.some((s) => s.startsWith(`${prop}:`))) styles.push(`${prop}:${cs.getPropertyValue(prop)}`);
    const attrs: Record<string, string> = {};
    for (const name of ATTRS) { const v = el.getAttribute(name); if (v != null) attrs[name] = v; }
    const children: Array<InsertNode | string> = [];
    for (const child of el.childNodes) {
      if (child.nodeType === 3) { const text = child.textContent ?? ''; if (text.trim()) children.push(text.replace(/\s+/g, ' ')); }
      else if (child.nodeType === 1) { const n = walk(child as Element, false); if (n) children.push(n); }
    }
    return { t: tag, ...(Object.keys(attrs).length ? { a: attrs } : {}), ...(styles.length ? { s: styles.join(';') } : {}), ...(children.length ? { c: children } : {}) };
  };
  try { return walk(root, true); } finally { sandbox.remove(); }
}

/** An SVG icon by its attributes alone, so `stroke="currentColor"` keeps following the app's text colour. */
export function svgToTree(el: Element): InsertNode | null {
  if (el.namespaceURI !== SVG_NS || !SVG_TAGS.has(el.localName)) return null;
  const attrs: Record<string, string> = {};
  for (const name of ATTRS) { const v = el.getAttribute(name); if (v != null) attrs[name] = v; }
  const children = [...el.children].map(svgToTree).filter((n): n is InsertNode => !!n);
  return { t: el.localName, a: attrs, ...(el.localName === 'svg' ? { s: 'display:inline-block;vertical-align:middle;flex-shrink:0' } : {}), ...(children.length ? { c: children } : {}) };
}

/** Element count, for tests and size checks. */
export function countNodes(n: InsertNode | string): number {
  return typeof n === 'string' ? 0 : 1 + (n.c ?? []).reduce((sum, c) => sum + countNodes(c), 0);
}
