import 'fake-indexeddb/auto';
import { getCommentShots, removeCommentShots, resetShotStore, saveCommentShots } from './shotStore';

afterEach(() => resetShotStore());

test('full-size comment screenshots are kept by comment id and can be removed', async () => {
  expect(await saveCommentShots({ commentId: 'c1', view: 'data:image/jpeg;base64,VklFVw==', element: 'data:image/jpeg;base64,RUw=', createdAt: 1 })).toBe(true);
  expect(await getCommentShots('c1')).toMatchObject({ view: 'data:image/jpeg;base64,VklFVw==', element: 'data:image/jpeg;base64,RUw=' });
  expect(await getCommentShots('missing')).toBeNull();
  await removeCommentShots('c1');
  expect(await getCommentShots('c1')).toBeNull();
});
