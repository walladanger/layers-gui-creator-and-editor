// @vitest-environment node
import { tagJsx } from './tag-jsx.js';
import radiumBridge from './vite.js';

test('HTML elements get their file:line:column and component; components and existing ids are left alone', () => {
  const code = [
    'export function Card({ title }: { title: string }) {',
    '  return <article className="card"><Title text={title} /><p data-rid="keep">x</p></article>;',
    '}',
  ].join('\n');
  const out = tagJsx(code, 'src/Card.tsx')!;
  expect(out.code).toContain('<article data-rid="src/Card.tsx:2:10" data-rcomp="Card" className="card">');
  expect(out.code).toContain('<Title text={title} />');
  expect(out.code).toContain('<p data-rid="keep">');
  expect(out.map).toBeTruthy();
});

test('arrow components, memo wrappers and anonymous default exports are named', () => {
  expect(tagJsx('const Row = memo(() => <li>a</li>);', 'src/Row.jsx')!.code).toContain('<li data-rid="src/Row.jsx:1:24" data-rcomp="Row">');
  expect(tagJsx('export default () => <span>hi</span>', 'src/Hello.jsx')!.code).toContain('data-rcomp="Hello"');
  expect(tagJsx('const helper = () => <b>x</b>;', 'src/util.jsx')!.code).not.toContain('data-rcomp');
});

test('files without JSX, or that do not parse, are returned untouched', () => {
  expect(tagJsx('export const a = 1 < 2;', 'src/a.ts')).toBeNull();
  expect(tagJsx('const x = <><Foo /></>;', 'src/b.jsx')).toBeNull();
  expect(tagJsx('<<<', 'src/c.jsx')).toBeNull();
});

test('the Vite plugin only runs on the dev server, tags app files and skips node_modules', () => {
  const plugin = radiumBridge() as { apply: string; enforce: string; configResolved(c: { root: string }): void; transform(code: string, id: string): { code: string } | null; transformIndexHtml(): { tag: string; attrs: Record<string, string> }[] };
  expect(plugin.apply).toBe('serve');
  expect(plugin.enforce).toBe('pre');
  plugin.configResolved({ root: '/app' });
  expect(plugin.transform('const A = () => <div />;', '/app/src/A.tsx')!.code).toContain('data-rid="src/A.tsx:1:17"');
  expect(plugin.transform('const A = () => <div />;', '/app/node_modules/x/A.jsx')).toBeNull();
  expect(plugin.transform('const A = () => <div />;', '/app/src/A.css')).toBeNull();
  expect(plugin.transformIndexHtml()[0]).toMatchObject({ tag: 'script', attrs: { src: '/@radium/radium-bridge.js' } });
  expect((radiumBridge({ sourceIds: false }) as typeof plugin).transform('const A = () => <div />;', '/app/src/A.tsx')).toBeNull();
});
