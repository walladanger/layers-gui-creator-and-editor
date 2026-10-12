import { badgeText, commentText, readCommentKind } from './FrameOverlay';

test('a Bug comment keeps its kind through save and read', () => {
  expect(commentText('Bug', ' Slider is too small ')).toBe('[Bug] Slider is too small');
  expect(readCommentKind('[Bug] Slider is too small')).toEqual({ kind: 'Bug', body: 'Slider is too small' });
});

test('a plain change comment has no prefix', () => {
  expect(commentText('Change', 'Make it blue')).toBe('Make it blue');
  expect(readCommentKind('Make it blue')).toEqual({ kind: 'Change', body: 'Make it blue' });
});

test('the badge names the element, its text and its component', () => {
  expect(badgeText({ nid: 'n1', tag: 'div', label: 'div.quant', text: 'Quantization Stored as Q4_K_M', comp: 'Model', selector: 'div' }))
    .toBe('div.quant “Quantization Stored as Q4_K_M” in Model');
});
