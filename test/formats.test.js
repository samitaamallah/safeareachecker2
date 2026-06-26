import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FORMATS, computeSafeArea, matchFormat, verdictForImage,
  parseAdSize, detectFormat,
} from '../src/formats.js';

test('FORMATS has the two known formats with correct margins', () => {
  const welcome = FORMATS.find(f => f.id === 'welcome');
  const mobile = FORMATS.find(f => f.id === 'mobile');
  assert.deepEqual(
    { w: welcome.totalWidth, h: welcome.totalHeight, m: welcome.margins },
    { w: 1920, h: 1080, m: { top: 40, bottom: 263, left: 0, right: 0 } }
  );
  assert.deepEqual(
    { w: mobile.totalWidth, h: mobile.totalHeight, m: mobile.margins },
    { w: 640, h: 1000, m: { top: 40, bottom: 207, left: 52, right: 52 } }
  );
});

test('computeSafeArea derives safe rectangle from margins', () => {
  const welcome = matchFormat(1920, 1080);
  assert.deepEqual(computeSafeArea(welcome), { x: 0, y: 40, width: 1920, height: 777 });
  const mobile = matchFormat(640, 1000);
  assert.deepEqual(computeSafeArea(mobile), { x: 52, y: 40, width: 536, height: 753 });
});

test('matchFormat requires exact dimensions', () => {
  assert.equal(matchFormat(1920, 1080).id, 'welcome');
  assert.equal(matchFormat(640, 1000).id, 'mobile');
  assert.equal(matchFormat(1921, 1080), null);
  assert.equal(matchFormat(1280, 720), null);
});

test('verdictForImage passes on exact match, fails otherwise', () => {
  const pass = verdictForImage(1920, 1080);
  assert.equal(pass.pass, true);
  assert.equal(pass.format.id, 'welcome');
  assert.match(pass.message, /Welcome Page \(1920×1080\)/);

  const fail = verdictForImage(1280, 720);
  assert.equal(fail.pass, false);
  assert.equal(fail.format, null);
  assert.match(fail.message, /1280×720 is not a known format/);
  assert.match(fail.message, /Expected 1920×1080 or 640×1000/);
});

test('parseAdSize reads the ad.size meta tag regardless of attribute order', () => {
  assert.deepEqual(
    parseAdSize('<meta name="ad.size" content="width=1920,height=1080">'),
    { width: 1920, height: 1080 }
  );
  assert.deepEqual(
    parseAdSize('<meta content="width=640, height=1000" name="ad.size">'),
    { width: 640, height: 1000 }
  );
  assert.equal(parseAdSize('<html><head></head></html>'), null);
});

test('detectFormat maps a recognized ad.size to a format', () => {
  assert.equal(detectFormat('<meta name="ad.size" content="width=1920,height=1080">').id, 'welcome');
  assert.equal(detectFormat('<meta name="ad.size" content="width=300,height=250">'), null);
  assert.equal(detectFormat('<html></html>'), null);
});
