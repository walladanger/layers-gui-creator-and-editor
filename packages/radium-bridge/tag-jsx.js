// Adds `data-rid="<file>:<line>:<col>"` and `data-rcomp="<Component>"` to every HTML element in a
// JSX/TSX file, so the studio can say exactly where an element lives in the source.
// Only lowercase (DOM) elements are tagged: component props are left alone, so nothing changes
// what a component receives. Elements that already carry `data-rid` are skipped.
import { parse } from '@babel/parser';
import MagicString from 'magic-string';

const SKIP_KEYS = new Set(['loc', 'start', 'end', 'range', 'extra', 'leadingComments', 'trailingComments', 'innerComments', 'comments', 'tokens']);
const isComponentName = (name) => typeof name === 'string' && /^[A-Z]/.test(name);
const attrValue = (value) => String(value).replace(/["\\{}<>]/g, '');

function componentNameOf(node, parent, file) {
  if ((node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') && isComponentName(node.id?.name)) return node.id.name;
  if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' && isComponentName(node.id.name)) return node.id.name;
  if (parent?.type === 'ExportDefaultDeclaration' && (node.type === 'FunctionDeclaration' || node.type === 'ArrowFunctionExpression' || node.type === 'ClassDeclaration') && !node.id) {
    const base = file.split('/').pop().replace(/\.[^.]+$/, '');
    return isComponentName(base) ? base : undefined;
  }
  return undefined;
}

/**
 * @param {string} code  the file's source
 * @param {string} file  path relative to the app root, with forward slashes
 * @returns {{ code: string, map: import('magic-string').SourceMap } | null}  null when nothing changed
 */
export function tagJsx(code, file) {
  if (!code.includes('<') || code.length > 2_000_000) return null;
  const typescript = /\.(tsx|ts|mts|cts)$/.test(file);
  let ast;
  try {
    ast = parse(code, { sourceType: 'module', errorRecovery: true, plugins: typescript ? ['jsx', 'typescript'] : ['jsx'] });
  } catch { return null; }
  const s = new MagicString(code);
  let changed = false;
  const visit = (node, parent, comp) => {
    if (!node || typeof node.type !== 'string') return;
    const here = componentNameOf(node, parent, file) ?? comp;
    if (node.type === 'JSXOpeningElement' && node.name?.type === 'JSXIdentifier' && /^[a-z]/.test(node.name.name)) {
      const has = node.attributes.some((a) => a.type === 'JSXAttribute' && a.name?.name === 'data-rid');
      if (!has && node.loc) {
        const rid = `${attrValue(file)}:${node.loc.start.line}:${node.loc.start.column + 1}`;
        s.appendLeft(node.name.end, ` data-rid="${rid}"${here ? ` data-rcomp="${attrValue(here)}"` : ''}`);
        changed = true;
      }
    }
    for (const key of Object.keys(node)) {
      if (SKIP_KEYS.has(key)) continue;
      const value = node[key];
      if (Array.isArray(value)) { for (const child of value) if (child && typeof child === 'object') visit(child, node, here); }
      else if (value && typeof value === 'object' && typeof value.type === 'string') visit(value, node, here);
    }
  };
  visit(ast.program, null, undefined);
  return changed ? { code: s.toString(), map: s.generateMap({ hires: true, source: file, includeContent: true }) } : null;
}
