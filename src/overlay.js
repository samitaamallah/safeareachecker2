import { computeSafeArea } from './formats.js';

export function fitScale(totalWidth, totalHeight, maxWidth, maxHeight) {
  return Math.min(1, maxWidth / totalWidth, maxHeight / totalHeight);
}

export function computeOverlayLayout(format, scale) {
  const safe = computeSafeArea(format);
  const { margins, totalWidth, totalHeight } = format;
  const innerH = (totalHeight - margins.top - margins.bottom) * scale;
  return {
    total: { width: totalWidth * scale, height: totalHeight * scale },
    safe: {
      x: safe.x * scale,
      y: safe.y * scale,
      width: safe.width * scale,
      height: safe.height * scale,
    },
    bands: {
      top: { x: 0, y: 0, width: totalWidth * scale, height: margins.top * scale },
      bottom: {
        x: 0,
        y: (totalHeight - margins.bottom) * scale,
        width: totalWidth * scale,
        height: margins.bottom * scale,
      },
      left: { x: 0, y: margins.top * scale, width: margins.left * scale, height: innerH },
      right: {
        x: (totalWidth - margins.right) * scale,
        y: margins.top * scale,
        width: margins.right * scale,
        height: innerH,
      },
    },
    labels: {
      top: margins.top,
      bottom: margins.bottom,
      left: margins.left,
      right: margins.right,
      safe: `Safe Area: ${safe.width}×${safe.height}px`,
      total: `Total size: ${totalWidth}×${totalHeight}px`,
    },
  };
}
