import { createMemoryDatabase, seedDemoProject } from './memoryAdapter';
import { createMemoryStorageAdapter, projectIdFromPath } from './storageService';
import { ChangeService } from './services';

function setup() {
  const db = createMemoryDatabase();
  const owner = seedDemoProject(db, 'owner');
  const projectId = db.projects.get(owner)!.id;
  db.project_members.set('m1', { id: 'm1', created_at: '', updated_at: '', project_id: projectId, user_id: 'editor', role: 'editor' });
  db.project_members.set('m2', { id: 'm2', created_at: '', updated_at: '', project_id: projectId, user_id: 'commenter', role: 'commenter' });
  const as = (userId: string | null) => createMemoryStorageAdapter(db, () => userId);
  return { as, projectId };
}

const png = () => new Blob(['png'], { type: 'image/png' });

test('the storage path contract matches §5: {project_id}/{change_record_id}-{before|after}.png', () => {
  expect(ChangeService.screenshotPath('p1', 'c1', 'before')).toBe('p1/c1-before.png');
  expect(projectIdFromPath(ChangeService.screenshotPath('p1', 'c1', 'after'))).toBe('p1');
});

test('owners and editors can upload, members can read, outsiders get nothing', async () => {
  const asOwner = setup('owner');
  const path = ChangeService.screenshotPath(asOwner.projectId, 'c1', 'before');
  await asOwner.storage.upload(path, png());
  expect(await asOwner.storage.signedUrl(path)).toContain(path);

  const asEditor = setup('editor');
  await asEditor.storage.upload(path, png()); // editors upload too

  const asCommenter = setup('commenter');
  await expect(asCommenter.storage.upload(path, png())).rejects.toThrow('rls-denied');
  await expect(asCommenter.storage.signedUrl(path)).rejects.toThrow('not-found'); // never uploaded here

  const asOutsider = setup('outsider');
  await expect(asOutsider.storage.upload(path, png())).rejects.toThrow('rls-denied');
  await expect(asOutsider.storage.signedUrl(path)).rejects.toThrow('rls-denied');

  const asNobody = setup(null);
  await expect(asNobody.storage.upload(path, png())).rejects.toThrow('rls-denied');
});

test('a commenter can read a file an editor uploaded, but cannot write or delete', async () => {
  const db = createMemoryDatabase();
  const seeded = seedDemoProject(db, 'owner');
  const projectId = db.projects.get(seeded)!.id;
  db.project_members.set('m1', { id: 'm1', created_at: '', updated_at: '', project_id: projectId, user_id: 'editor', role: 'editor' });
  db.project_members.set('m2', { id: 'm2', created_at: '', updated_at: '', project_id: projectId, user_id: 'commenter', role: 'commenter' });
  let user: string | null = 'editor';
  const storage = createMemoryStorageAdapter(db, () => user);
  const path = `${projectId}/c2-after.png`;
  await storage.upload(path, png());
  user = 'commenter';
  expect(await storage.signedUrl(path)).toContain(path);
  await expect(storage.upload(path, png())).rejects.toThrow('rls-denied');
  await expect(storage.remove(path)).rejects.toThrow('rls-denied');
});
