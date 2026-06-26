// In-memory virtual server for unzipped creative assets.
const STORE = new Map(); // id -> Map(path -> { bytes, mime })

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'STORE_CREATIVE') {
    const map = new Map();
    for (const f of data.files) map.set(f.path, { bytes: f.bytes, mime: f.mime });
    STORE.set(data.id, map);
    if (event.source) event.source.postMessage({ type: 'STORED', id: data.id });
  } else if (data.type === 'CLEAR_CREATIVE') {
    STORE.delete(data.id);
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const m = url.pathname.match(/\/preview\/([^/]+)\/(.*)$/);
  if (!m) return; // not ours — let the network handle it
  const id = m[1];
  const map = STORE.get(id);
  if (!map) return;

  let path = decodeURIComponent(m[2]);
  if (path === '') path = 'index.html';
  const hit = resolve(map, path);
  if (!hit) {
    event.respondWith(new Response('Not found in bundle: ' + path, { status: 404 }));
    return;
  }
  event.respondWith(new Response(hit.bytes, { headers: { 'Content-Type': hit.mime } }));
});

function resolve(map, path) {
  const noSlash = path.replace(/^\.?\//, '');
  if (map.has(noSlash)) return map.get(noSlash);
  if (map.has(path)) return map.get(path);
  const dirIndex = (noSlash.endsWith('/') ? noSlash : noSlash + '/') + 'index.html';
  if (map.has(dirIndex)) return map.get(dirIndex);
  return null;
}
