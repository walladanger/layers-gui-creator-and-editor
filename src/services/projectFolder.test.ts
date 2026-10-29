import { dataUrlToBlob, writeFiles, type WritableDir } from './projectFolder';

function memoryDir(name = 'my-app') {
  const files = new Map<string, string | Blob>();
  const dir = (path: string): WritableDir => ({
    name: path || name,
    async getDirectoryHandle(child) { return dir(path ? `${path}/${child}` : child); },
    async getFileHandle(child) {
      const full = path ? `${path}/${child}` : child;
      return { async createWritable() { let data: string | Blob = ''; return { async write(d: string | Blob) { data = d; }, async close() { files.set(full, data); } }; } };
    },
  });
  return { root: dir(''), files };
}

test('files are written under nested folders that are created on the way', async () => {
  const { root, files } = memoryDir();
  await writeFiles(root, [{ path: '.radium/production/plan.md', data: '# Plan' }, { path: '.radium/production/shots/RPL-001-view.jpg', data: dataUrlToBlob('data:image/jpeg;base64,AAEC') }]);
  expect(files.get('.radium/production/plan.md')).toBe('# Plan');
  const shot = files.get('.radium/production/shots/RPL-001-view.jpg') as Blob;
  expect(shot.type).toBe('image/jpeg');
  expect(shot.size).toBe(3);
});

test('paths that climb out of the chosen folder are refused', async () => {
  const { root } = memoryDir();
  await expect(writeFiles(root, [{ path: '../outside.md', data: 'x' }])).rejects.toThrow('Unsafe path');
});
