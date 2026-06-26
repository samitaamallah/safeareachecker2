import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchFormat } from '../src/formats.js';
import { fitScale, computeOverlayLayout } from '../src/overlay.js';

test('fitScale never upscales and fits within the box', () => {
  assert.equal(fitScale(1920, 1080, 960, 1080), 0.5);
  assert.equal(fitScale(640, 1000, 5000, 5000), 1); // capped at 1
  assert.equal(fitScale(1000, 1000, 250, 500), 0.25); // width is the binding limit
});

test('computeOverlayLayout scales bands, safe rect and labels (mobile @ 0.5)', () => {
  const layout = computeOverlayLayout(matchFormat(640, 1000), 0.5);
  assert.deepEqual(layout.total, { width: 320, height: 500 });
  assert.deepEqual(layout.safe, { x: 26, y: 20, width: 268, height: 376.5 });
  assert.deepEqual(layout.bands.top, { x: 0, y: 0, width: 320, height: 20 });
  assert.deepEqual(layout.bands.bottom, { x: 0, y: 396.5, width: 320, height: 103.5 });
  assert.deepEqual(layout.bands.left, { x: 0, y: 20, width: 26, height: 376.5 });
  assert.deepEqual(layout.bands.right, { x: 294, y: 20, width: 26, height: 376.5 });
  assert.equal(layout.labels.top, 40);
  assert.equal(layout.labels.bottom, 207);
  assert.equal(layout.labels.left, 52);
  assert.equal(layout.labels.right, 52);
  assert.equal(layout.labels.safe, 'Safe Area: 536×753px');
  assert.equal(layout.labels.total, 'Total size: 640×1000px');
});
