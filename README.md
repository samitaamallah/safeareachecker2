# Safe Area Checker

A static, browser-only tool to check ad creatives against fixed safe-area
guidelines and overlay the safe area on top of the rendered creative.

## Supported inputs

| Input | Verdict | Notes |
|-------|---------|-------|
| PNG / JPG / GIF | Recognized size vs. **Wrong size** (dimensions only) | 1920×1080 → Welcome Page, 640×1000 → Mobile Takeover. A recognized size is **not** an approval — the safe area is always a visual check against the overlay. Animated GIFs decode to frames — a thumbnail rail (plus play/pause) lets you click through and check every frame |
| Zipped HTML5 creative (`.zip`) | none (overlay only) | Unpacked in-browser and served by a service worker; assets (even JS-built URLs) resolve |
| Third-party tag (paste) | none (overlay only) | Rendered in a sandboxed iframe; must be HTTPS and needs internet |

## Formats

| Format | Total | Margins (T/B/L/R) | Safe area |
|--------|-------|-------------------|-----------|
| Welcome Page | 1920×1080 | 40 / 263 / 0 / 0 | 1920×777 |
| Mobile Takeover | 640×1000 | 40 / 207 / 52 / 52 | 536×753 |

To change these, edit the `FORMATS` array in `src/formats.js`.

## Run locally

Service workers need http(s), so use a static server (not `file://`):

```bash
python3 -m http.server 8000
# open http://localhost:8000/
```

## Test

```bash
npm test
```

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. Settings → Pages → Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
3. Open `https://<username>.github.io/<repo>/`.

All paths are relative, so the service worker and assets work under the
`/<repo>/` subpath.

## Known limitations

- Third-party tags require internet and must be served over HTTPS (mixed
  content is blocked on the HTTPS Pages site).
- For zipped creatives, only assets bundled in the zip are virtualized;
  assets fetched from an external origin still go to the network.
- The first ever visit registers the service worker; if you load a zip in
  that exact first moment the tool will ask you to reload once.
- Frame-by-frame GIF stepping uses the WebCodecs `ImageDecoder` API
  (Chrome / Edge / Safari 16.4+). In browsers without it, an animated GIF
  still plays as a normal looping animation — you just can't pause on a frame.
