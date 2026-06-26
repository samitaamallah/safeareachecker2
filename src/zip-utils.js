function depth(p) {
  return (p.match(/\//g) || []).length;
}

export function findEntryHtml(paths) {
  const htmls = paths.filter(p => /\.html?$/i.test(p));
  if (htmls.length === 0) return null;

  const rootIndex = htmls.find(p => /^index\.html?$/i.test(p));
  if (rootIndex) return rootIndex;

  const indexes = htmls.filter(p => /(^|\/)index\.html?$/i.test(p));
  const pool = indexes.length ? indexes : htmls;
  return pool.slice().sort((a, b) => depth(a) - depth(b) || a.length - b.length)[0];
}

const MIME = {
  html: 'text/html', htm: 'text/html', css: 'text/css',
  js: 'text/javascript', mjs: 'text/javascript', json: 'application/json',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  svg: 'image/svg+xml', webp: 'image/webp', ico: 'image/x-icon',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
  mp4: 'video/mp4', webm: 'video/webm', xml: 'application/xml', txt: 'text/plain',
};

export function mimeTypeForPath(path) {
  const ext = (path.split('.').pop() || '').toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}
