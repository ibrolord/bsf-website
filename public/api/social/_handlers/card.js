// ═══════════════════════════════════════════════════════════════
//  /api/social/card — branded social image cards (SVG)
//
//  Extends the og-image.js approach to multiple platform formats and
//  templates, themed from _lib/brand.js. Returns SVG; the admin UI
//  rasterises it to PNG (canvas) for download / manual posting.
//
//  Query params:
//    format    feed-square | feed-portrait | story | landscape | link
//    template  quote | stat | event | story | announcement
//    theme     green | terracotta | brown | cream
//    eyebrow   small uppercase label (e.g. OUR STORY)
//    headline  main line(s)
//    subtext   supporting line / attribution / date · location
//    stat      big number (stat template)
//    statLabel label under the number (stat template)
// ═══════════════════════════════════════════════════════════════

import { BRAND, COLORS, FONTS, CARD_FORMATS, escapeXml, wrapText } from '../../_lib/brand.js';

const THEMES = {
  green: { bg: COLORS.greenDeep, fg: COLORS.cream, eyebrow: COLORS.gold, accent: COLORS.terracotta, sub: COLORS.sage, treeLeaf: COLORS.sage, treeTrunk: COLORS.brown, halo: COLORS.green },
  terracotta: { bg: COLORS.terracotta, fg: COLORS.cream, eyebrow: COLORS.cream, accent: COLORS.greenDeep, sub: '#FBEAD9', treeLeaf: '#E0A57E', treeTrunk: COLORS.brown, halo: '#B0653F' },
  brown: { bg: COLORS.brown, fg: COLORS.cream, eyebrow: COLORS.gold, accent: COLORS.gold, sub: COLORS.sage, treeLeaf: COLORS.sage, treeTrunk: '#2A1D14', halo: '#2A1D14' },
  cream: { bg: COLORS.cream, fg: COLORS.greenDeep, eyebrow: COLORS.terracotta, accent: COLORS.terracotta, sub: COLORS.green, treeLeaf: COLORS.sage, treeTrunk: COLORS.brown, halo: '#EFE3D0' }
};

function clamp(text, max) {
  const value = String(text == null ? '' : text);
  return value.length > max ? value.slice(0, max) : value;
}

// Iroko tree mark — three overlapping canopy circles on a tall trunk with roots.
function treeMotif(cx, cy, scale, opacity, leaf, trunk) {
  return `<g transform="translate(${cx},${cy}) scale(${scale})" opacity="${opacity}">
    <circle cx="0" cy="-46" r="40" fill="${leaf}"/>
    <circle cx="-34" cy="-22" r="34" fill="${leaf}"/>
    <circle cx="34" cy="-22" r="34" fill="${leaf}"/>
    <rect x="-5" y="-14" width="10" height="118" rx="4" fill="${trunk}"/>
    <path d="M0 104 L-26 130 M0 104 L0 134 M0 104 L26 130" stroke="${trunk}" stroke-width="5" stroke-linecap="round" fill="none"/>
  </g>`;
}

// Choose a starting headline font size (fraction of width) by text length.
function pickHeadlineSize(text, W) {
  const len = text.length;
  let frac;
  if (len <= 36) frac = 0.090;
  else if (len <= 72) frac = 0.072;
  else if (len <= 130) frac = 0.058;
  else if (len <= 210) frac = 0.047;
  else frac = 0.040;
  return Math.round(W * frac);
}

// ── Element-based layout with a fit-to-bounds loop ──
// Each element: { role, text, size, minSize, charW, lh, maxLines, gapBefore,
//                 font, weight, color, spacing, singleLine, transform, dividerW }

function measureElement(el, contentW) {
  if (el.role === 'divider') {
    el.lines = [];
    el.height = el.size;
    return el;
  }
  if (el.singleLine) {
    el.lines = [el.text];
  } else {
    const charsPerLine = Math.max(6, Math.floor(contentW / (el.size * el.charW)));
    el.lines = wrapText(el.text, charsPerLine, el.maxLines);
  }
  el.height = Math.max(1, el.lines.length) * el.size * el.lh;
  return el;
}

function totalHeight(els) {
  return els.reduce((sum, el) => sum + (el.gapBefore || 0) + el.height, 0);
}

// Shrink the tallest text element until the stack fits availableH.
function fitElements(els, contentW, availableH) {
  for (const el of els) {
    if (el.singleLine) {
      const estWidth = el.text.length * el.size * el.charW;
      if (estWidth > contentW) el.size = Math.max(el.minSize, el.size * (contentW / estWidth));
    }
    measureElement(el, contentW);
  }
  let guard = 0;
  while (totalHeight(els) > availableH && guard++ < 60) {
    let target = null;
    for (const el of els) {
      if (el.role === 'divider') continue;
      if (!target || el.size > target.size) target = el;
    }
    if (!target || target.size <= target.minSize) break;
    target.size = Math.max(target.minSize, target.size * 0.92);
    measureElement(target, contentW);
  }
  return els;
}

function renderElement(el, centerX, topY) {
  if (el.role === 'divider') {
    return `<rect x="${Math.round(centerX - el.dividerW / 2)}" y="${Math.round(topY + el.height / 2 - 1.5)}" width="${Math.round(el.dividerW)}" height="3" rx="1.5" fill="${el.color}"/>`;
  }
  const lh = el.size * el.lh;
  return el.lines
    .map((line, i) => {
      const safe = escapeXml(line);
      const content = el.transform ? el.transform(safe, i, el.lines.length) : safe;
      const y = Math.round(topY + el.size + i * lh);
      const spacing = el.spacing ? ` letter-spacing="${el.spacing}"` : '';
      return `<text x="${centerX}" y="${y}" text-anchor="middle" fill="${el.color}" font-family="${el.font}" font-size="${Math.round(el.size)}" font-weight="${el.weight}"${spacing}>${content}</text>`;
    })
    .join('\n  ');
}

function buildCard(params) {
  const format = CARD_FORMATS[params.format] ? params.format : 'feed-square';
  const { w: W, h: H } = CARD_FORMATS[format];
  const theme = THEMES[params.theme] || THEMES.green;
  const template = params.template || 'quote';
  const tall = format === 'feed-portrait' || format === 'story' || format === 'feed-square';

  const pad = Math.round(W * 0.08);
  const contentW = W - pad * 2;
  const centerX = W / 2;

  const eyebrow = clamp(params.eyebrow, 48).toUpperCase();
  const headline = clamp(params.headline, 300);
  const subtext = clamp(params.subtext, 220);
  const statValue = clamp(params.stat, 16);
  const statLabel = clamp(params.statLabel, 80);

  // ── Chrome: background, faint halos, corner tree watermark ──
  const chrome = [
    `<rect width="${W}" height="${H}" fill="${theme.bg}"/>`,
    `<circle cx="${W - pad}" cy="${pad * 1.4}" r="${W * 0.34}" fill="${theme.halo}" opacity="0.28"/>`,
    `<circle cx="${pad * 0.4}" cy="${H - pad * 0.6}" r="${W * 0.24}" fill="${theme.halo}" opacity="0.18"/>`,
    treeMotif(W - pad * 1.5, pad * 2.1, (W / 1080) * 0.95, 0.13, theme.treeLeaf, theme.treeTrunk)
  ].join('\n  ');

  // ── Eyebrow (fixed near top) ──
  const eyebrowSize = Math.round(W * 0.024);
  const eyebrowY = Math.round(pad * 1.2 + eyebrowSize);
  const eyebrowSvg = eyebrow
    ? `<text x="${centerX}" y="${eyebrowY}" text-anchor="middle" fill="${theme.eyebrow}" font-family="${FONTS.sans}" font-size="${eyebrowSize}" font-weight="700" letter-spacing="${Math.round(W * 0.006)}">${escapeXml(eyebrow)}</text>`
    : '';

  // ── Footer geometry ──
  const footerBaseline = H - Math.round(pad * 0.85);
  const footerTop = footerBaseline - Math.round(W * 0.075);

  // ── Safe content band (between eyebrow and footer) ──
  const contentTop = (eyebrow ? eyebrowY : pad) + Math.round(W * 0.05);
  const contentBottom = footerTop - Math.round(W * 0.06);
  const availableH = Math.max(60, contentBottom - contentTop);

  // ── Build content elements per template ──
  const els = [];
  if (template === 'stat' && statValue) {
    els.push({ role: 'stat', text: statValue, singleLine: true, size: Math.min(W * 0.17, H * 0.32), minSize: W * 0.08, charW: 0.62, lh: 1.0, font: FONTS.serif, weight: 700, color: theme.accent });
    if (statLabel) els.push({ role: 'statLabel', text: statLabel, size: Math.round(W * 0.036), minSize: W * 0.02, charW: 0.52, lh: 1.25, maxLines: 2, gapBefore: Math.round(W * 0.02), font: FONTS.sans, weight: 500, color: theme.fg, spacing: 0.5 });
    if (headline && tall) els.push({ role: 'sup', text: headline, size: Math.round(W * 0.029), minSize: W * 0.02, charW: 0.5, lh: 1.35, maxLines: 2, gapBefore: Math.round(W * 0.035), font: FONTS.serif, weight: 400, color: theme.sub });
  } else {
    if (headline) {
      const maxLines = format === 'story' ? 7 : format === 'landscape' || format === 'link' ? 4 : 6;
      els.push({ role: 'headline', text: headline, size: pickHeadlineSize(headline, W), minSize: W * 0.032, charW: 0.5, lh: 1.18, maxLines, font: FONTS.serif, weight: 600, color: theme.fg, transform: template === 'quote' ? (t, i, n) => (i === 0 ? '“' : '') + t + (i === n - 1 ? '”' : '') : null });
    }
    if (subtext) {
      els.push({ role: 'divider', size: Math.round(W * 0.016), dividerW: W * 0.12, gapBefore: Math.round(W * 0.04), color: theme.accent });
      els.push({ role: 'subtext', text: subtext, size: Math.round(W * 0.03), minSize: W * 0.02, charW: 0.52, lh: 1.3, maxLines: 3, gapBefore: Math.round(W * 0.03), font: FONTS.sans, weight: 500, color: theme.sub });
    }
  }

  fitElements(els, contentW, availableH);

  // ── Lay out vertically, centred within the band ──
  let y = contentTop + Math.max(0, (availableH - totalHeight(els)) / 2);
  const contentSvg = els
    .map((el) => {
      y += el.gapBefore || 0;
      const svg = renderElement(el, centerX, y);
      y += el.height;
      return svg;
    })
    .join('\n  ');

  // ── Footer: rule + brand name + tagline ──
  const footer = [
    `<rect x="${pad}" y="${footerTop}" width="${Math.round(W * 0.11)}" height="3" rx="1.5" fill="${theme.accent}"/>`,
    `<text x="${pad}" y="${footerBaseline - Math.round(W * 0.026)}" fill="${theme.fg}" font-family="${FONTS.serif}" font-size="${Math.round(W * 0.032)}" font-weight="600">${escapeXml(BRAND.name)}</text>`,
    `<text x="${pad}" y="${footerBaseline}" fill="${theme.eyebrow}" font-family="${FONTS.sans}" font-size="${Math.round(W * 0.016)}" font-weight="600" letter-spacing="${Math.round(W * 0.004)}">${escapeXml(BRAND.taglineUpper)}</text>`
  ].join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${chrome}
  ${eyebrowSvg}
  ${contentSvg}
  ${footer}
</svg>`;
}

export default function handler(req, res) {
  const q = req.query || {};
  const svg = buildCard({
    format: String(q.format || 'feed-square'),
    template: String(q.template || 'quote'),
    theme: String(q.theme || 'green'),
    eyebrow: q.eyebrow,
    headline: q.headline,
    subtext: q.subtext,
    stat: q.stat,
    statLabel: q.statLabel
  });

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
  res.status(200).send(svg);
}

// Exported for tests / reuse by the auto-drafter.
export { buildCard };
