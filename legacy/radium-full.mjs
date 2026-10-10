import { chromium } from 'playwright';
const PAGE = new URL('../index.html', import.meta.url).href;
const launch = () => chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
const p = await ctx.newPage();
const errs = []; const log = (...a) => console.log(...a);
p.on('pageerror', e => errs.push(String(e)));
p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
await p.goto(PAGE);
await p.waitForTimeout(600);
const wait = (ms=150) => p.waitForTimeout(ms);
const view = async (sel) => { await p.locator(sel).first().evaluate(el => el.scrollIntoView({ block: 'center' })); await wait(120); return p.locator(sel).first().boundingBox(); };
const cs = (sel, prop) => p.locator(sel).first().evaluate((el, pr) => getComputedStyle(el).getPropertyValue(pr), prop);

// --- grab: move a model row
await p.keyboard.press('v');
let bb = await view('[data-k="model:gemma3:27b"]');
await p.mouse.move(bb.x + 200, bb.y + 12); await p.mouse.down(); await p.mouse.move(bb.x + 240, bb.y + 30, { steps: 6 }); await p.mouse.up(); await wait();
log('1 move translate:', await cs('[data-k="model:gemma3:27b"]', 'translate'));
// resize west handle
bb = await p.locator('#ed-sel .ed-h[data-h="w"]').boundingBox();
await p.mouse.move(bb.x + 4, bb.y + 4); await p.mouse.down(); await p.mouse.move(bb.x + 64, bb.y + 4, { steps: 5 }); await p.mouse.up(); await wait();
log('2 resize width:', await cs('[data-k="model:gemma3:27b"]', 'width'), 'translate', await cs('[data-k="model:gemma3:27b"]', 'translate'));
// radius dot
bb = await p.locator('#ed-sel .ed-r').boundingBox();
await p.mouse.move(bb.x + 5, bb.y + 5); await p.mouse.down(); await p.mouse.move(bb.x + 45, bb.y + 45, { steps: 5 }); await p.mouse.up(); await wait();
log('3 radius:', await cs('[data-k="model:gemma3:27b"]', 'border-top-left-radius'));
// inspector: glow + edge colour + preset + per-corner
await p.keyboard.press('i'); await wait();
await p.locator('#if-galpha').fill('70'); await p.locator('#if-galpha').dispatchEvent('change'); await wait();
await p.locator('#if-bcol').evaluate(el => { el.value = '#ff3366'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }); await wait();
log('4 glow shadow set:', (await cs('[data-k="model:gemma3:27b"]', 'box-shadow')).slice(0, 60), '| border colour:', await cs('[data-k="model:gemma3:27b"]', 'border-top-color'));
await p.locator('#ed-insp [data-ed="rlink"]').click(); await wait();
await p.locator('#if-rtl').fill('30'); await wait();
log('5 per-corner radius:', await cs('[data-k="model:gemma3:27b"]', 'border-radius'));
await p.screenshot({ path: 'shot-insp.png' });
await p.locator('#ed-insp [data-ed="apreset"][data-v="Neon"]').click(); await wait();
log('6 preset neon border:', await cs('[data-k="model:gemma3:27b"]', 'border-top-color'));
// delete + undo
await p.keyboard.press('Delete'); await wait();
log('7 deleted display:', await cs('[data-k="model:gemma3:27b"]', 'display'));
await p.keyboard.press('Control+z'); await wait();
log('8 undo display:', await cs('[data-k="model:gemma3:27b"]', 'display'));
// reorder stats
await p.keyboard.press('Escape'); await p.getByRole('button', { name: 'Tiles', exact: true }).click(); await wait(500);
await p.locator('#ed-bar [data-ed="drag"][data-v="reorder"]').click();
await p.evaluate(() => scrollTo(0, 0)); await wait();
const s1 = await p.locator('[data-k="stat:models"]').boundingBox(), s3 = await p.locator('[data-k="stat:speed"]').boundingBox();
await p.mouse.move(s1.x + 20, s1.y + 20); await p.mouse.down(); await p.mouse.move(s3.x + s3.width - 8, s3.y + 20, { steps: 8 }); await p.mouse.up(); await wait();
log('9 order:', await p.evaluate(() => [...document.querySelectorAll('[data-k^="stat:"]')].map(e => e.dataset.k.slice(5) + getComputedStyle(e).order).join(' ')));
// comment
await p.keyboard.press('c');
bb = await view('[data-k="set:flashAttention"]');
await p.mouse.click(bb.x + 40, bb.y + 12); await wait();
await p.keyboard.type('Make this a toggle card with an explainer'); await p.keyboard.press('Control+Enter'); await wait();
log('10 notes saved:', await p.evaluate(() => JSON.parse(localStorage.getItem('panel-lab:notes')).length));
await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
// motion: open panel, chase is on by default; click a button in Use mode
await p.keyboard.press('m'); await wait();
await p.screenshot({ path: 'shot-motion.png' });
await p.locator('#ed-motion [data-ed="fx-on"][data-id="pulse"]').click(); await wait();
bb = await view('[data-act="restart"]');
await p.mouse.click(bb.x + 20, bb.y + 10); await wait(250);
log('11 effect overlays while playing:', await p.locator('.fx-o').count());
await p.screenshot({ path: 'shot-chase.png' });
await p.locator('#ed-motion [data-ed="fx-play"][data-id="warp"]').click(); await wait(100);
await p.locator('#ed-motion [data-ed="fx-play"][data-id="enter"]').click(); await wait(100);
await p.keyboard.press('m');
// style lab: preset, colour, save look, reset
await p.locator('#panel [data-preset="Neon"]').click(); await wait(300);
await p.screenshot({ path: 'shot-neon.png' });
log('12 neon good colour:', await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--good')));
await p.locator('#lookName').fill('Neon test'); await p.locator('#saveLook').click(); await wait();
log('13 looks:', await p.evaluate(() => JSON.parse(localStorage.getItem('panel-lab:looks')).map(l => l.name)));
await p.locator('#resetAll').click(); await wait(); await p.locator('#dlg-ok').click(); await wait(300);
log('14 after reset: theme', await p.evaluate(() => document.documentElement.getAttribute('data-theme')), 'looks', await p.evaluate(() => JSON.parse(localStorage.getItem('panel-lab:looks')).map(l => l.name).join(' | ')), 'edits', await p.evaluate(() => document.getElementById('ed-css').textContent.length));
await p.locator('.look-apply').filter({ hasText: 'Neon test' }).click(); await wait(300);
log('15 applied look good:', await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--good')), 'layout', await p.evaluate(() => document.getElementById('page').className));
// greens glow chip
await p.locator('#panel [data-psec="greens"] summary').click(); await wait();
await p.locator('#panel [data-chip="good-glow"][data-v="0.7"]').click(); await wait();
log('16 pill glow:', (await cs('.pill', 'box-shadow')).slice(0, 50));
// runtime: settings profile + per-model
await p.keyboard.press('Escape');
await p.getByRole('button', { name: 'Rows', exact: true }).click(); await wait(400);
await view('[data-k="profiles"]');
await p.locator('#cb-prof').click(); await wait();
await p.locator('[role="option"]').filter({ hasText: 'One big model' }).click(); await wait();
log('17 profile loaded ctx:', await p.locator('#num-contextLength').inputValue());
await p.locator('#cb-prof').click(); await wait();
await p.locator('[role="option"]').filter({ hasText: 'Save these settings' }).click(); await wait();
await p.locator('#prof-name').fill('My big setup'); await p.keyboard.press('Enter'); await wait();
log('18 profiles:', await p.evaluate(() => localStorage.getItem('panel-lab:srv-profiles')));
await view('[data-k="mcfg:qwen3:32b"]');
await p.locator('[data-k="mcfg:qwen3:32b"] [data-act="mprof"][data-v="mp-code"]').click(); await wait();
const r = p.locator('#mr-qwen3_32b-temperature'); await r.fill('0.35'); await r.dispatchEvent('change'); await wait();
await p.locator('[data-k="mcfg:qwen3:32b"] [data-act="msave"]').click(); await wait();
log('19 model cfg:', await p.evaluate(() => localStorage.getItem('panel-lab:model-cfg')));
await p.locator('[data-k="mcfg:qwen3:32b"] [data-act="modelfile"]').click(); await wait();
log('20 modelfile:', JSON.stringify(await p.evaluate(() => navigator.clipboard.readText())));
await p.screenshot({ path: 'shot-model.png' });
await p.setViewportSize({ width: 400, height: 800 }); await wait(300);
log('21 width at 400:', await p.evaluate(() => document.documentElement.scrollWidth));
await p.screenshot({ path: 'shot-mobile.png' });
log('ERRORS', JSON.stringify(errs));
await b.close();
