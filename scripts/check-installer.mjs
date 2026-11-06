import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => readFile(path.join(root, file), 'utf8');
const config = JSON.parse(await read('src-tauri/tauri.conf.json'));
const pkg = JSON.parse(await read('package.json'));
const lock = JSON.parse(await read('package-lock.json'));
const cargo = await read('src-tauri/Cargo.toml');
const nativeVersion = /\[package\][\s\S]*?^version = "([^"]+)"/m.exec(cargo)?.[1];
if ([pkg.version, lock.version, lock.packages[''].version, nativeVersion].some(v => v !== config.version)) {
  throw new Error('Installer, npm, lockfile, and Cargo versions must match.');
}
if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME !== 'v' + config.version) {
  throw new Error('The release tag must match the installer version.');
}
for (const icon of config.bundle.icon ?? []) {
  const file = path.join(root, 'src-tauri', icon);
  if (!(await stat(file)).isFile()) throw new Error('Missing installer icon: ' + icon);
  if (icon.endsWith('.ico')) {
    const bytes = await readFile(file);
    if (bytes.length < 6 || bytes.readUInt32LE(0) !== 65536 || bytes.readUInt16LE(4) === 0) throw new Error('Invalid Windows icon: ' + icon);
  }
}
if (!config.bundle.targets.includes('nsis') || !config.bundle.targets.includes('msi')) throw new Error('Both Windows installers must be enabled.');
console.log('Installer inputs verified: ' + config.productName + ' ' + config.version);
