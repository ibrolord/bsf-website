// ═══════════════════════════════════════════════════════════════
//  BSF BRAND — single source of truth for Social Studio
//
//  Everything the caption generator (/api/social/generate) and the
//  card generator (/api/social/card) need to stay on-brand lives here,
//  sourced from assets/brand/final/Brand_Guide.pdf and reconciled with
//  the colours already shipping in og-image.js (rendered truth).
//
//  Voice = "The Caregiver + The Advocate": gentle strength. She does
//  not shout — she shows up. She does not perform care — she provides it.
// ═══════════════════════════════════════════════════════════════

// ── Identity ──
export const BRAND = {
  name: 'Big Sister Foundation',
  shortName: 'BSF',
  motif: 'iroko tree', // rooted, sheltering, enduring
  tagline: 'Rooted. Present. Protective.',
  taglineUpper: 'ROOTED. PRESENT. PROTECTIVE.',
  promise: 'You are not alone. We are here. And we are staying.',
  mission:
    'To give the disenfranchised access to resources that enable them to become community-level raisers.',
  url: 'thebigsisterfoundation.org',
  // Public handles — update when accounts are finalised.
  handles: {
    instagram: '@bigsisterfoundation',
    facebook: 'Big Sister Foundation',
    twitter: '@bigsisterfdn'
  },
  // The three pathways BSF serves.
  pathways: ['Difficult Backgrounds', 'Special Needs & Disabilities', 'Gifted Potential'],
  // Lagos communities BSF works in — use for grounded, specific copy.
  communities: ['Makoko', 'Iwaya', 'Ajegunle', 'Surulere', 'Ikorodu', 'Ajah/Sangotedo', 'Victoria Island', 'Ikeja']
};

// ── Colour palette (hex) ──
// Aligned with og-image.js so Social cards match existing OG images.
export const COLORS = {
  greenDeep: '#1E3F2B', // primary card background (Iroko green, deep)
  green: '#2D5E40',     // mid green — panels, accents
  sage: '#8BAF8E',      // light green — soft accents, "dignity"
  gold: '#D4A96A',      // warm gold — eyebrows, dividers, "community"
  terracotta: '#C2734C',// warm terracotta — emphasis, "direct impact"
  cream: '#FFF8F0',     // cream — light backgrounds + text on dark
  brown: '#3A2A1F'      // deep brown — tree trunk, "empowerment"
};

// Value → colour map (Brand Guide p.5).
export const VALUE_COLORS = {
  transparency: COLORS.green,
  'direct impact': COLORS.terracotta,
  dignity: COLORS.sage,
  community: COLORS.gold,
  empowerment: COLORS.brown
};

// ── Typography (SVG-safe stacks; mirror og-image.js) ──
export const FONTS = {
  serif: "Georgia, 'Times New Roman', serif", // headlines (brand uses a warm display serif)
  sans: "system-ui, -apple-system, 'Segoe UI', sans-serif" // eyebrows / labels / meta
};

// ── Voice spec (Brand Guide p.8–9) ──
export const VOICE = {
  archetype: 'The Caregiver + The Advocate',
  essence: 'Gentle strength. She does not shout — she shows up. She does not perform care — she provides it.',
  traits: [
    { name: 'Grounded', note: 'Speak from experience, never theory. Our words have roots.' },
    { name: 'Protective', note: 'Tone wraps around the reader. Firm when needed, always with care.' },
    { name: 'Simple but Powerful', note: 'Say what matters in few words. Clarity is kindness.' },
    { name: 'Reassuring', note: 'Remind people they are not alone. Presence is the message.' },
    { name: 'Warm', note: 'Lead with heart. No distance in the language, only closeness.' },
    { name: 'Caring', note: 'Every word serves the person hearing it, not the one saying it.' }
  ],
  weSay: ['You are not alone.', 'We are here.', 'You matter.', 'This is your space.'],
  weDontSay: ['We saved them.', 'These poor people…', 'Look what we did.', 'Donate now!'],
  // Real on-brand social example from the guide (p.9) — used as a few-shot anchor.
  socialExample:
    "She was 9 when she first came to us. Quiet. Watchful. Today she's 14, in school, and writing poetry about the future. We didn't save her. We showed up. She did the rest.",
  socialExampleNote: 'Personal. Grounded. Centres the person, not the organisation.'
};

// ── Platform constraints ──
// captionMax = hard limit; captionSweet = where good posts actually land.
export const PLATFORMS = {
  instagram: {
    label: 'Instagram',
    captionMax: 2200,
    captionSweet: [125, 600],
    hashtagMax: 30,
    hashtagSweet: [8, 15],
    formats: ['feed-square', 'feed-portrait', 'story'],
    notes:
      'Lead with the hook in the first 125 chars (before "more"). Hashtags can sit at the end. Line breaks help readability. A few tasteful emoji are fine; never spammy.'
  },
  facebook: {
    label: 'Facebook',
    captionMax: 5000,
    captionSweet: [80, 500],
    hashtagMax: 5,
    hashtagSweet: [1, 3],
    formats: ['link', 'feed-square'],
    notes:
      'Conversational and a little longer than IG is fine. Few or no hashtags. A clear, soft call to action (learn more / read the story) rather than a hard sell.'
  },
  twitter: {
    label: 'X (Twitter)',
    captionMax: 280,
    captionSweet: [120, 270],
    hashtagMax: 3,
    hashtagSweet: [1, 2],
    formats: ['landscape'],
    notes:
      'One sharp idea. Tight and human. 1–2 hashtags at most. Must stay at or under 280 characters including hashtags.'
  }
};

export const PLATFORM_KEYS = Object.keys(PLATFORMS);

// ── Card formats (px) ──
export const CARD_FORMATS = {
  'feed-square': { w: 1080, h: 1080, label: 'Square 1:1 (IG/FB feed)' },
  'feed-portrait': { w: 1080, h: 1350, label: 'Portrait 4:5 (IG feed)' },
  story: { w: 1080, h: 1920, label: 'Story 9:16 (IG/FB)' },
  landscape: { w: 1200, h: 675, label: 'Landscape 16:9 (X)' },
  link: { w: 1200, h: 630, label: 'Link 1.91:1 (FB/X link)' }
};

// ── Card templates (visual layouts the card generator knows how to draw) ──
export const CARD_TEMPLATES = {
  quote: { label: 'Quote / story', note: 'A short human line, centred. The default voice card.' },
  stat: { label: 'Impact stat', note: 'One number + a plain-language fact. For transparency posts.' },
  event: { label: 'Event', note: 'Title, date, location. For announcements and outreach.' },
  story: { label: 'Story spotlight', note: 'A scholar/community spotlight headline.' },
  announcement: { label: 'Announcement', note: 'A heading + supporting line.' }
};

// Default card format per platform (first listed format).
export function defaultFormatFor(platform) {
  const spec = PLATFORMS[platform];
  return spec ? spec.formats[0] : 'feed-square';
}

export function platformSpec(platform) {
  return PLATFORMS[platform] || null;
}

export function cardDimensions(format) {
  return CARD_FORMATS[format] || CARD_FORMATS['feed-square'];
}

// ── Shared SVG text helpers (reused by the card generator) ──
export function escapeXml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Greedy word-wrap into at most maxLines lines of ~maxChars each.
// The last line is ellipsised if content overflows.
export function wrapText(text, maxChars, maxLines) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? current + ' ' + word : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    } else {
      current = candidate;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  // If words remain beyond maxLines, ellipsise the final line.
  const consumed = lines.join(' ').split(/\s+/).filter(Boolean).length;
  if (consumed < words.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && (last.length + 1) > maxChars) last = last.slice(0, -1);
    lines[lines.length - 1] = last.replace(/[\s.,;:]+$/, '') + '…';
  }
  return lines;
}

// ── Hashtag + platform-limit enforcement (shared by generate + persistence) ──
// Normalises tags to "#Word" form, dedupes, and caps to max.
export function normalizeHashtags(tags, max) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(tags) ? tags : []) {
    const cleaned = String(raw == null ? '' : raw).trim().replace(/^#+/, '').replace(/[^A-Za-z0-9_]/g, '');
    if (!cleaned) continue;
    const tag = '#' + cleaned;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (max && out.length >= max) break;
  }
  return out;
}

function truncateToWord(text, maxLength) {
  const value = String(text || '');
  if (value.length <= maxLength) return value;
  const slice = value.slice(0, Math.max(0, maxLength));
  const cut = slice.lastIndexOf(' ');
  return (cut > maxLength * 0.6 ? slice.slice(0, cut) : slice).replace(/[\s,;:.\-–—]+$/, '');
}

// Enforce a platform's caption + hashtag limits. For X, the combined
// caption + hashtags must stay within captionMax (280). The single
// source of truth for limits — used by both generation and persistence.
export function enforcePlatformLimits(platform, caption, hashtags) {
  const spec = PLATFORMS[platform] || PLATFORMS.instagram;
  let cap = truncateToWord(caption, spec.captionMax);
  let tags = normalizeHashtags(hashtags, spec.hashtagMax);
  if (platform === 'twitter') {
    const tagLen = (t) => (t.length ? 1 + t.join(' ').length : 0);
    while (tags.length && cap.length + tagLen(tags) > spec.captionMax) tags = tags.slice(0, -1);
    if (cap.length + tagLen(tags) > spec.captionMax) cap = truncateToWord(cap, spec.captionMax - tagLen(tags));
  }
  return { caption: cap, hashtags: tags };
}

// ── Voice system prompt for the caption generator ──
// One reusable instruction block so captions obey the brand guide.
export function voiceSystemPrompt() {
  return [
    `You write social media copy for ${BRAND.name} (${BRAND.url}), a Lagos, Nigeria nonprofit that invests in vulnerable children and their families across three pathways: ${BRAND.pathways.join(', ')}.`,
    '',
    `BRAND VOICE — ${VOICE.archetype}. ${VOICE.essence}`,
    'Write with these qualities:',
    ...VOICE.traits.map((t) => `- ${t.name}: ${t.note}`),
    '',
    'WE SAY (the spirit to capture): ' + VOICE.weSay.map((s) => `"${s}"`).join(' '),
    'WE NEVER SAY (avoid this completely): ' + VOICE.weDontSay.map((s) => `"${s}"`).join(' '),
    '',
    'HARD RULES:',
    '- No saviour language. The children and families are the protagonists, never the charity. Never imply we rescued anyone.',
    '- No pity, no "poor children", no fundraising hype, no "Donate now!", no fake urgency, no clickbait.',
    '- No jargon, no NGO-speak, no AI tells ("In a world where…", "Join us as we…", "Not just X, but Y").',
    '- Centre a real person or a concrete moment where possible. Specifics over abstractions.',
    `- You may reference real communities for grounding when relevant: ${BRAND.communities.slice(0, 6).join(', ')}.`,
    '- Honest and transparent: BSF maps every donation to a named child on a public ledger. Trust is demonstrated, not asked for.',
    '- Plain Nigerian-English. Warm, calm, human. Clarity is kindness.',
    '',
    'A post that sounds right (reference only — do not copy):',
    `"${VOICE.socialExample}" — ${VOICE.socialExampleNote}`
  ].join('\n');
}

export default BRAND;
