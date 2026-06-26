import { FORMATS, verdictForImage, detectFormat, computeSafeArea } from './src/formats.js';
import { findEntryHtml, mimeTypeForPath } from './src/zip-utils.js';
import { fitScale, computeOverlayLayout } from './src/overlay.js';

const el = (id) => document.getElementById(id);
const fileInput = el('file-input');
const toolbar = el('toolbar');
const homeBtn = el('home-btn');
const tagModal = el('tag-modal');
const tagInput = el('tag-input');
const tagFormat = el('tag-format');
const tagRenderBtn = el('tag-render');
const tagCancelBtn = el('tag-cancel');
const formatControl = el('format-control');
const formatLabel = el('format-label');
const formatSelect = el('format-select');
const overlaySwitch = el('overlay-switch');
const overlayToggle = el('overlay-toggle');
const artboard = el('artboard');
const stageCenter = el('stage-center');
const stage = el('stage');
const empty = el('empty');
const emptyDrop = el('empty-drop');
const emptyChoose = el('empty-choose');
const emptyTagBtn = el('empty-tag-btn');
const verdict = el('verdict');
const verdictMain = el('verdict-main');
const verdictDetail = el('verdict-detail');
const themeToggle = el('theme-toggle');
const gifRail = el('gif-rail');
const gifThumbs = el('gif-thumbs');
const gifPlay = el('gif-play');

let currentScale = 1;
let creativeCounter = 0;
let current = null;       // { kind:'image'|'zip'|'tag', ... }
let gif = null;           // { frames:[{canvas,duration}], idx, playing, timer, ctx, cw, ch }

// --- service worker registration (relative path → works under a Pages subpath) ---
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW registration failed', e));
}

// --- theme ---
function applyThemeIcon() {
  themeToggle.textContent = document.documentElement.dataset.theme === 'dark' ? '☀' : '☾';
}
applyThemeIcon();
themeToggle.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('sac-theme', next); } catch (e) {}
  applyThemeIcon();
});

// --- small UI helpers ---
function box() {
  const r = stageCenter.getBoundingClientRect();
  return [Math.max(240, r.width - 48), Math.max(240, r.height - 48)];
}
function setVerdict(kind, main, detail) {
  verdict.className = 'bar-verdict ' + kind;
  verdictMain.textContent = main;
  verdictDetail.textContent = detail || '';
}
function showEmpty(show) { empty.hidden = !show; }
function showChrome() { showEmpty(false); toolbar.hidden = false; }
function goHome() {
  clearStage();
  current = null;
  toolbar.hidden = true;
  hideFormatControl();
  showOverlaySwitch(false);
  showEmpty(true);
}
function showOverlaySwitch(show) { overlaySwitch.hidden = !show; }
function showFormatControl(labelText) { formatLabel.textContent = labelText; formatControl.hidden = false; }
function hideFormatControl() { formatControl.hidden = true; }
function getSelectedFormat() { return FORMATS.find(f => f.id === formatSelect.value) || FORMATS[0]; }
function safeStr(format) { const s = computeSafeArea(format); return `safe ${s.width}×${s.height}`; }
function sizeStage(format, scale) {
  stage.style.width = format.totalWidth * scale + 'px';
  stage.style.height = format.totalHeight * scale + 'px';
}
function stopGif() {
  if (gif && gif.timer) clearTimeout(gif.timer);
  gif = null;
  gifRail.hidden = true;
  gifThumbs.innerHTML = '';
}
function clearStage() {
  stopGif();
  stage.innerHTML = '';
}

// --- overlay rendering ---
function makeLabel(text, x, y, center) {
  const lbl = document.createElement('div');
  lbl.className = 'label' + (center ? ' center' : '');
  lbl.textContent = text;
  lbl.style.left = x + 'px';
  lbl.style.top = y + 'px';
  return lbl;
}
function renderOverlay(format) {
  const old = stage.querySelector('.overlay');
  if (old) old.remove();

  const layout = computeOverlayLayout(format, currentScale);
  const overlay = document.createElement('div');
  overlay.className = 'overlay' + (overlayToggle.checked ? '' : ' hidden');

  for (const key of ['top', 'bottom', 'left', 'right']) {
    const b = layout.bands[key];
    if (b.width <= 0 || b.height <= 0) continue;
    const elBand = document.createElement('div');
    elBand.className = 'band';
    Object.assign(elBand.style, { left: b.x + 'px', top: b.y + 'px', width: b.width + 'px', height: b.height + 'px' });
    overlay.appendChild(elBand);
  }

  // box-sizing: border-box → the 2px dashed border sits inside, so the box's
  // outer edge aligns exactly with the safe rectangle (no fudge factor).
  const safe = document.createElement('div');
  safe.className = 'safe';
  Object.assign(safe.style, {
    left: layout.safe.x + 'px', top: layout.safe.y + 'px',
    width: layout.safe.width + 'px', height: layout.safe.height + 'px',
  });
  overlay.appendChild(safe);

  overlay.appendChild(makeLabel(layout.labels.total, layout.total.width / 2, layout.total.height - 14, true));
  overlay.appendChild(makeLabel(layout.labels.safe, layout.total.width / 2, layout.safe.y + 16, true));
  if (layout.labels.top) overlay.appendChild(makeLabel(layout.labels.top + 'px', layout.total.width / 2, layout.bands.top.height / 2, true));
  if (layout.labels.bottom) overlay.appendChild(makeLabel(layout.labels.bottom + 'px', layout.total.width / 2, layout.bands.bottom.y + layout.bands.bottom.height / 2, true));

  stage.appendChild(overlay);
}

// --- GIF frame engine (WebCodecs ImageDecoder) ---
async function decodeGifFrames(file) {
  if (typeof ImageDecoder === 'undefined') return null;
  const data = await file.arrayBuffer();
  const decoder = new ImageDecoder({ data, type: 'image/gif' });
  await decoder.tracks.ready;
  const track = decoder.tracks.selectedTrack;
  const count = track ? track.frameCount : 1;
  const frames = [];
  for (let i = 0; i < count; i++) {
    const { image } = await decoder.decode({ frameIndex: i });
    const c = document.createElement('canvas');
    c.width = image.displayWidth;
    c.height = image.displayHeight;
    c.getContext('2d').drawImage(image, 0, 0);
    frames.push({ canvas: c, duration: image.duration ? image.duration / 1000 : 100 });
    image.close();
  }
  return frames;
}
function buildGifRail(frames) {
  gifThumbs.innerHTML = '';
  frames.forEach((f, i) => {
    const b = document.createElement('button');
    b.className = 'thumb';
    b.type = 'button';
    const tw = 100, th = Math.max(1, Math.round(100 * f.canvas.height / f.canvas.width));
    const tc = document.createElement('canvas');
    tc.width = tw; tc.height = th;
    tc.getContext('2d').drawImage(f.canvas, 0, 0, tw, th);
    const num = document.createElement('span');
    num.className = 'thumb-num';
    num.textContent = String(i + 1);
    b.appendChild(tc);
    b.appendChild(num);
    b.addEventListener('click', () => { setGifPlaying(false); drawGifFrame(i); });
    gifThumbs.appendChild(b);
  });
}
function drawGifFrame(idx) {
  gif.idx = idx;
  gif.ctx.clearRect(0, 0, gif.cw, gif.ch);
  gif.ctx.drawImage(gif.frames[idx].canvas, 0, 0, gif.cw, gif.ch);
  const thumbs = gifThumbs.children;
  for (let i = 0; i < thumbs.length; i++) thumbs[i].classList.toggle('active', i === idx);
  const active = thumbs[idx];
  if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
}
function gifTick() {
  if (!gif || !gif.playing) return;
  const next = (gif.idx + 1) % gif.frames.length;
  drawGifFrame(next);
  gif.timer = setTimeout(gifTick, Math.max(20, gif.frames[next].duration));
}
function setGifPlaying(play) {
  if (!gif) return;
  gif.playing = play;
  gifPlay.textContent = play ? '❚❚' : '►';
  if (gif.timer) clearTimeout(gif.timer);
  if (play) gif.timer = setTimeout(gifTick, Math.max(20, gif.frames[gif.idx].duration));
}

// --- image / gif path ---
async function handleImageFile(file) {
  showChrome();
  const isGif = /\.gif$/i.test(file.name) || file.type === 'image/gif';
  let frames = null;
  if (isGif) {
    try { frames = await decodeGifFrames(file); }
    catch (e) { frames = null; }
  }
  if (frames && frames.length > 0) {
    renderImageResult(frames[0].canvas.width, frames[0].canvas.height, { frames });
  } else {
    const img = new Image();
    img.onload = () => renderImageResult(img.naturalWidth, img.naturalHeight, { img, isGif });
    img.onerror = () => setVerdict('bad', 'Error', 'Could not load image file.');
    img.src = URL.createObjectURL(file);
  }
}
function renderImageResult(w, h, source) {
  const v = verdictForImage(w, h);
  current = { kind: 'image', w, h, source, format: v.format, pass: v.pass };
  hideFormatControl();
  clearStage();

  // Reserve the frame rail before measuring, so the creative is scaled to fit
  // the space that remains beside it.
  const multi = !!(source.frames && source.frames.length > 1);
  if (multi) gifRail.hidden = false;

  currentScale = fitScale(w, h, ...box());
  const cw = w * currentScale, ch = h * currentScale;
  stage.style.width = cw + 'px';
  stage.style.height = ch + 'px';

  let frameNote = '';
  if (source.frames) {
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    stage.appendChild(canvas);
    gif = { frames: source.frames, idx: 0, playing: false, timer: null, ctx: canvas.getContext('2d'), cw, ch };
    if (multi) { buildGifRail(source.frames); frameNote = ' · ' + source.frames.length + ' frames'; }
    drawGifFrame(0);
    if (multi) setGifPlaying(true);
  } else {
    const img = source.img;
    img.style.width = cw + 'px';
    img.style.height = ch + 'px';
    stage.appendChild(img);
    if (source.isGif) frameNote = ' · animated (frame stepping not supported in this browser)';
  }

  if (v.pass) {
    renderOverlay(v.format);
    showOverlaySwitch(true);
    setVerdict('info', `${v.format.name} · ${w}×${h}`,
      `Size matches${frameNote} · ${safeStr(v.format)} — your content must stay inside the dashed safe area`);
  } else {
    showOverlaySwitch(false);
    setVerdict('bad', 'Wrong size', v.message);
  }
}

// --- service worker helpers (zip path) ---
async function ensureController() {
  if (!('serviceWorker' in navigator)) return false;
  if (navigator.serviceWorker.controller) return true;
  await navigator.serviceWorker.ready;
  if (navigator.serviceWorker.controller) return true;
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    navigator.serviceWorker.addEventListener('controllerchange', () => finish(true), { once: true });
    setTimeout(() => finish(!!navigator.serviceWorker.controller), 1500);
  });
}
function storeCreative(id, files) {
  return new Promise((resolve, reject) => {
    const sw = navigator.serviceWorker.controller;
    if (!sw) return reject(new Error('no controller'));
    const onMsg = (e) => {
      if (e.data && e.data.type === 'STORED' && e.data.id === id) {
        navigator.serviceWorker.removeEventListener('message', onMsg);
        resolve();
      }
    };
    navigator.serviceWorker.addEventListener('message', onMsg);
    sw.postMessage({ type: 'STORE_CREATIVE', id, files }, files.map(f => f.bytes));
    setTimeout(resolve, 2000); // safety: proceed even if ack is missed
  });
}

function makeIframe(format, allowForms) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups' + (allowForms ? ' allow-forms' : ''));
  iframe.style.width = format.totalWidth + 'px';
  iframe.style.height = format.totalHeight + 'px';
  iframe.style.transformOrigin = 'top left';
  iframe.style.transform = 'scale(' + currentScale + ')';
  return iframe;
}

// --- zip path ---
async function handleZipFile(file) {
  showChrome();
  setVerdict('info', 'Working…', 'Unpacking zip');
  const ok = await ensureController();
  if (!ok) { setVerdict('bad', 'Service worker', 'Still initializing — reload the page and try again.'); return; }

  let zip;
  try { zip = await JSZip.loadAsync(file); }
  catch (e) { setVerdict('bad', 'Error', 'Could not read zip file.'); return; }

  const paths = Object.keys(zip.files).filter(p => !zip.files[p].dir);
  const entry = findEntryHtml(paths);
  if (!entry) { setVerdict('bad', 'No HTML', 'No HTML file found inside the zip.'); return; }

  const files = [];
  for (const p of paths) {
    const bytes = await zip.files[p].async('arraybuffer');
    files.push({ path: p, bytes, mime: mimeTypeForPath(p) });
  }

  const entryHtml = await zip.file(entry).async('string');
  const detected = detectFormat(entryHtml);
  const id = 'c' + (++creativeCounter);
  await storeCreative(id, files);

  current = { kind: 'zip', id, entry, detected: !!detected };
  if (detected) formatSelect.value = detected.id;
  showFormatControl(detected ? 'Auto-detected' : 'Format');
  renderZip();
}
function renderZip() {
  const format = getSelectedFormat();
  clearStage();
  currentScale = fitScale(format.totalWidth, format.totalHeight, ...box());
  sizeStage(format, currentScale);
  const iframe = makeIframe(format);
  iframe.src = new URL('preview/' + current.id + '/' + current.entry, location.href).href;
  stage.appendChild(iframe);
  renderOverlay(format);
  showOverlaySwitch(true);
  setVerdict('info', 'Preview', `${format.name} · ${format.totalWidth}×${format.totalHeight}` +
    (current.detected ? ' · auto-detected' : '') + ` · ${safeStr(format)} · verify against the overlay`);
}

// --- third-party tag path ---
function openTagModal() { tagFormat.value = formatSelect.value; tagModal.hidden = false; tagInput.focus(); }
function closeTagModal() { tagModal.hidden = true; }
function renderTag(markup) {
  current = { kind: 'tag', markup };
  showChrome();
  tagModal.hidden = true;
  showFormatControl('Format');
  const format = getSelectedFormat();
  clearStage();
  currentScale = fitScale(format.totalWidth, format.totalHeight, ...box());
  sizeStage(format, currentScale);
  const iframe = makeIframe(format, true);
  iframe.srcdoc =
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden}</style>' +
    '</head><body>' + markup + '</body></html>';
  stage.appendChild(iframe);
  renderOverlay(format);
  showOverlaySwitch(true);
  setVerdict('info', 'Preview', `${format.name} · ${format.totalWidth}×${format.totalHeight} · needs internet & HTTPS · verify against the overlay`);
}

// --- dispatch ---
function handleFile(file) {
  const isZip = /\.zip$/i.test(file.name) || file.type === 'application/zip';
  if (isZip) handleZipFile(file);
  else if (/^image\//.test(file.type) || /\.(png|jpe?g|gif)$/i.test(file.name)) handleImageFile(file);
  else setVerdict('bad', 'Unsupported', 'Use PNG, JPG, GIF, or a ZIP bundle.');
}

// --- re-layout on format change / window resize ---
function relayout() {
  if (!current) return;
  if (current.kind === 'image') renderImageResult(current.w, current.h, current.source);
  else if (current.kind === 'zip') renderZip();
  else if (current.kind === 'tag') renderTag(current.markup);
}

// --- events ---
homeBtn.addEventListener('click', goHome);
emptyDrop.addEventListener('click', () => fileInput.click());
emptyChoose.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
emptyTagBtn.addEventListener('click', (e) => { e.stopPropagation(); openTagModal(); });
fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); fileInput.value = ''; });

tagCancelBtn.addEventListener('click', closeTagModal);
tagModal.addEventListener('click', (e) => { if (e.target === tagModal) closeTagModal(); });
tagRenderBtn.addEventListener('click', () => {
  const m = tagInput.value.trim();
  if (!m) { setVerdict('bad', 'Empty', 'Paste a third-party tag first.'); return; }
  formatSelect.value = tagFormat.value;   // sync the chosen format to the toolbar control
  renderTag(m);
});

formatSelect.addEventListener('change', () => {
  if (!current || current.kind === 'image') return;
  if (current.kind === 'zip' && current.detected) { current.detected = false; showFormatControl('Format'); }
  relayout();
});
overlayToggle.addEventListener('change', () => {
  const o = stage.querySelector('.overlay');
  if (o) o.classList.toggle('hidden', !overlayToggle.checked);
});

gifPlay.addEventListener('click', () => setGifPlaying(!(gif && gif.playing)));

['dragenter', 'dragover'].forEach(ev => artboard.addEventListener(ev, (e) => { e.preventDefault(); artboard.classList.add('drag'); }));
['dragleave', 'drop'].forEach(ev => artboard.addEventListener(ev, (e) => { e.preventDefault(); artboard.classList.remove('drag'); }));
artboard.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) handleFile(f); });

let resizeTimer = null;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(relayout, 150); });
