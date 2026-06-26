export const FORMATS = [
  {
    id: 'welcome',
    name: 'Welcome Page',
    totalWidth: 1920,
    totalHeight: 1080,
    margins: { top: 40, bottom: 263, left: 0, right: 0 },
  },
  {
    id: 'mobile',
    name: 'Mobile Takeover',
    totalWidth: 640,
    totalHeight: 1000,
    margins: { top: 40, bottom: 207, left: 52, right: 52 },
  },
];

export function computeSafeArea(format) {
  const { totalWidth, totalHeight, margins } = format;
  return {
    x: margins.left,
    y: margins.top,
    width: totalWidth - margins.left - margins.right,
    height: totalHeight - margins.top - margins.bottom,
  };
}

export function matchFormat(width, height) {
  return FORMATS.find(f => f.totalWidth === width && f.totalHeight === height) || null;
}

export function verdictForImage(width, height) {
  const format = matchFormat(width, height);
  if (format) {
    return {
      pass: true,
      format,
      message: `${format.name} (${width}×${height}).`,
    };
  }
  return {
    pass: false,
    format: null,
    message: `${width}×${height} is not a known format. Expected 1920×1080 or 640×1000.`,
  };
}

export function parseAdSize(html) {
  const tags = html.match(/<meta[^>]*>/gi) || [];
  for (const tag of tags) {
    if (!/name\s*=\s*["']ad\.size["']/i.test(tag)) continue;
    const content = tag.match(/content\s*=\s*["']([^"']+)["']/i);
    if (!content) continue;
    const w = content[1].match(/width\s*=\s*(\d+)/i);
    const h = content[1].match(/height\s*=\s*(\d+)/i);
    if (w && h) return { width: Number(w[1]), height: Number(h[1]) };
  }
  return null;
}

export function detectFormat(html) {
  const size = parseAdSize(html);
  if (!size) return null;
  return matchFormat(size.width, size.height);
}
