import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findEntryHtml, mimeTypeForPath } from '../src/zip-utils.js';

test('findEntryHtml prefers a root index.html', () => {
  assert.equal(
    findEntryHtml(['assets/logo.png', 'index.html', 'styles/main.css']),
    'index.html'
  );
});

test('findEntryHtml falls back to shallowest index.html, then shallowest html', () => {
  assert.equal(findEntryHtml(['creative/index.html', 'creative/a.js']), 'creative/index.html');
  assert.equal(findEntryHtml(['deep/nested/index.html', 'top/index.html']), 'top/index.html');
  assert.equal(findEntryHtml(['a/b/page.html']), 'a/b/page.html');
});

test('findEntryHtml returns null when no html present', () => {
  assert.equal(findEntryHtml(['a.png', 'b.css']), null);
});

test('mimeTypeForPath maps known extensions and falls back', () => {
  assert.equal(mimeTypeForPath('index.html'), 'text/html');
  assert.equal(mimeTypeForPath('main.css'), 'text/css');
  assert.equal(mimeTypeForPath('app.js'), 'text/javascript');
  assert.equal(mimeTypeForPath('logo.PNG'), 'image/png');
  assert.equal(mimeTypeForPath('photo.jpg'), 'image/jpeg');
  assert.equal(mimeTypeForPath('anim.gif'), 'image/gif');
  assert.equal(mimeTypeForPath('font.woff2'), 'font/woff2');
  assert.equal(mimeTypeForPath('data.bin'), 'application/octet-stream');
});
