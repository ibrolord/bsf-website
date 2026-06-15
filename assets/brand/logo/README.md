# Big Sister Foundation — Logo

The mark is the **iroko tree** ("the sheltering tree"): overlapping translucent
canopy ellipses over a trunk that splays into roots. Wide canopy = shelter,
deep roots = community.

## Files

### `png/` — official artwork (exact, extracted from the brand guide)
Transparent PNGs. Use these for slides, social, documents, and anywhere raster
is fine.

| File | Use |
|------|-----|
| `mark-green.png` | Primary mark, on light backgrounds |
| `mark-white.png` | Reversed mark, on dark backgrounds |
| `lockup-vertical-green.png` | Primary full lockup (mark + wordmark + tagline) |
| `lockup-vertical-brown.png` | Secondary lockup |
| `lockup-vertical-white.png` | Reversed lockup, transparent (for any dark bg) |
| `lockup-vertical-on-green.png` | Reversed lockup on a solid green plate |
| `lockup-horizontal-green.png` | Horizontal lockup — headers, email signatures, letterhead |

### `svg/` — scalable mark (vector rebuild)
Crisp at any size. Faithful rebuild of the mark from primitives (the brand guide
art itself is raster, so these are a close trace, not the original source).

- `mark-green.svg` — primary
- `mark-white.svg` — reversed

### `favicon/`
- `favicon.svg` — scalable, square crop of the mark
- `favicon-16.png`, `favicon-32.png` — raster fallbacks
- `apple-touch-icon.png` — 180×180 on a cream plate (iOS home screen)

## Colours
Iroko Green `#2D5E40` · Deep Brown `#3A2A1F` (trunk) · Sage `#7FA886`/`#8BAF8E`
(highlight) · Cream `#FFF8F0` (reversed). Full palette in `../README.md`.

## Usage
- Default to **green-on-light**. Use a reversed (white) version on dark backgrounds.
- Keep clear space around the mark equal to the height of the trunk.
- Minimum size: mark 24px, full lockup 120px, horizontal lockup 200px.
- **Don't** stretch, rotate, recolour, add shadows/glows, or place on busy photos
  without a solid overlay.

## Note
The live site currently draws a **simplified** version of this mark as inline SVG
(`public/` favicon and `og-image.svg`) — three flat ellipses, no highlight. To
make the site match this richer mark, swap those for `favicon/favicon.svg` and
`svg/mark-green.svg`.
