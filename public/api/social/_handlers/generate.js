// ═══════════════════════════════════════════════════════════════
//  /api/social/generate — brand-true captions + hashtags + card text
//
//  Per platform (Instagram / Facebook / X), generates a caption,
//  hashtags, and the text for a branded image card. Uses the same
//  multi-provider pattern as generate-post.js: Claude (primary) →
//  OpenAI (fallback) → deterministic template (graceful degradation).
//
//  generateForPlatforms() is exported so the cron auto-drafter (Block F)
//  can reuse it without going through HTTP/auth.
// ═══════════════════════════════════════════════════════════════

import { z } from 'zod';

import { requireAnyPermission } from '../../_lib/auth.js';
import {
  error,
  json,
  methodNotAllowed,
  nodeHeadersToWebHeaders,
  nodeRequestBodyToString,
  nodeRequestUrl,
  sendNodeResponse
} from '../../_lib/response.js';
import { voiceSystemPrompt, PLATFORMS, PLATFORM_KEYS, CARD_TEMPLATES, defaultFormatFor, enforcePlatformLimits, BRAND } from '../../_lib/brand.js';

const ALLOWED_METHODS = ['POST'];
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const OPENAI_MODEL = 'gpt-4o-mini';

const sourceSchema = z.object({
  type: z.enum(['topic', 'blog', 'event', 'story', 'manual']).default('topic'),
  title: z.string().trim().max(300).optional().default(''),
  text: z.string().trim().max(8000).optional().default(''),
  refId: z.string().trim().max(200).optional().default('')
});

const generateSchema = z.object({
  source: sourceSchema,
  platforms: z.array(z.enum(['instagram', 'facebook', 'twitter'])).min(1).max(3).optional().default(['instagram', 'facebook', 'twitter']),
  tone: z.string().trim().max(200).optional().default('')
});

function log(level, payload) {
  const logger = console[level] || console.log;
  logger(JSON.stringify(Object.assign({ area: 'social-generate' }, payload)));
}

function extractJson(text) {
  if (!text) return null;
  const match = String(text).match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (_error) {
    return null;
  }
}

function buildPrompt(platform, spec, source, tone) {
  const sourceBlock = source.type === 'topic' || !source.text
    ? `WHAT TO POST ABOUT:\n${source.title || source.text}`
    : `REPURPOSE THIS ${source.type.toUpperCase()} INTO ONE SOCIAL POST (do not copy it verbatim — distil the human heart of it):\nTitle: ${source.title}\nContent:\n${source.text}`;

  return [
    voiceSystemPrompt(),
    '',
    `PLATFORM: ${spec.label}.`,
    `- Caption length: aim for ${spec.captionSweet[0]}–${spec.captionSweet[1]} characters (hard maximum ${spec.captionMax}). ${spec.notes}`,
    `- Hashtags: ${spec.hashtagSweet[0]}–${spec.hashtagSweet[1]} genuinely relevant tags (max ${spec.hashtagMax}). Mix a brand tag with cause/locale tags. No generic spam tags, no "#like4like".`,
    tone ? `- Extra direction for this post: ${tone}` : '',
    '',
    sourceBlock,
    '',
    'Also write text for a branded IMAGE CARD that will accompany the post:',
    '- cardEyebrow: a 1–3 word UPPERCASE label (e.g. OUR STORY, IMPACT, YOU ARE INVITED, TRANSPARENCY)',
    '- cardHeadline: the single most powerful line, max 140 chars — the big text on the image',
    '- cardSubtext: a short supporting line or attribution, max 80 chars',
    `- cardTemplate: one of ${Object.keys(CARD_TEMPLATES).join(' | ')} — choose what best fits this post`,
    '',
    'Respond with JSON only, no prose:',
    '{"caption":"...","hashtags":["#Tag"],"cardEyebrow":"...","cardHeadline":"...","cardSubtext":"...","cardTemplate":"quote"}'
  ].filter(Boolean).join('\n');
}

// ── Providers (mirror generate-post.js) ──
async function callClaude(prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!res.ok) {
      log('warn', { provider: 'claude', code: 'http_error', status: res.status });
      return null;
    }
    const data = await res.json();
    return data && data.content && data.content[0] ? data.content[0].text : null;
  } catch (claudeError) {
    log('warn', { provider: 'claude', code: 'request_failed', message: claudeError.message });
    return null;
  }
}

async function callOpenAI(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!res.ok) {
      log('warn', { provider: 'openai', code: 'http_error', status: res.status });
      return null;
    }
    const data = await res.json();
    return data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : null;
  } catch (openaiError) {
    log('warn', { provider: 'openai', code: 'request_failed', message: openaiError.message });
    return null;
  }
}

// Deterministic fallback so the feature still works with no AI keys.
function fallbackContent(source) {
  const base = String(source.text || source.title || BRAND.promise).trim();
  const firstSentence = (base.split(/(?<=[.!?])\s+/)[0] || base).trim();
  return {
    caption: source.type === 'topic' && source.title ? source.title : firstSentence,
    hashtags: ['#BigSisterFoundation', '#Lagos', '#EveryChildMatters'],
    cardEyebrow: BRAND.shortName.toUpperCase(),
    cardHeadline: firstSentence.slice(0, 140),
    cardSubtext: BRAND.tagline,
    cardTemplate: 'quote'
  };
}

function shapeResult(platform, parsed, model) {
  const fitted = enforcePlatformLimits(platform, String(parsed.caption || '').trim(), parsed.hashtags);
  const template = CARD_TEMPLATES[parsed.cardTemplate] ? parsed.cardTemplate : 'quote';
  return {
    platform,
    caption: fitted.caption,
    hashtags: fitted.hashtags,
    card: {
      template,
      format: defaultFormatFor(platform),
      theme: 'green',
      eyebrow: String(parsed.cardEyebrow || '').trim().slice(0, 48),
      headline: String(parsed.cardHeadline || fitted.caption || '').trim().slice(0, 300),
      subtext: String(parsed.cardSubtext || '').trim().slice(0, 220)
    },
    model
  };
}

async function generateOne(platform, source, tone) {
  const spec = PLATFORMS[platform];
  const prompt = buildPrompt(platform, spec, source, tone);

  // Try Claude; if it returns nothing parseable, try OpenAI; then deterministic.
  let model = CLAUDE_MODEL;
  let parsed = extractJson(await callClaude(prompt));
  if (!parsed) {
    model = OPENAI_MODEL;
    parsed = extractJson(await callOpenAI(prompt));
  }
  if (!parsed) return shapeResult(platform, fallbackContent(source), 'fallback');
  return shapeResult(platform, parsed, model);
}

// Core — reused by the POST handler and the cron auto-drafter.
export async function generateForPlatforms({ source, platforms, tone }) {
  const list = (Array.isArray(platforms) && platforms.length ? platforms : PLATFORM_KEYS).filter((p) => PLATFORMS[p]);
  const results = await Promise.all(
    list.map((p) =>
      generateOne(p, source, tone || '').catch(() => shapeResult(p, fallbackContent(source), 'fallback'))
    )
  );
  return { results, aiSkipped: results.every((r) => r.model === 'fallback') };
}

function errorFromException(exception) {
  if (exception && exception.status) {
    return error(exception.status, exception.code || 'request_failed', exception.message, exception.details);
  }
  return error(500, 'internal_error', 'Generation failed');
}

export async function POST(request) {
  let context;
  try {
    context = await requireAnyPermission(request, ['social.create', 'social.edit']);
  } catch (authError) {
    return errorFromException(authError);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (_parseError) {
    return error(400, 'invalid_json', 'Request body must be valid JSON');
  }

  const parsed = generateSchema.safeParse(payload || {});
  if (!parsed.success) {
    return error(400, 'invalid_payload', 'Request payload did not match the expected shape', {
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
    });
  }

  const source = parsed.data.source;
  const hasSource = source.type === 'topic' ? Boolean(source.title) : Boolean(source.title || source.text);
  if (!hasSource) {
    return error(400, 'missing_source', 'Provide a topic or source content to generate from');
  }

  try {
    const out = await generateForPlatforms(parsed.data);
    return json({ ok: true, results: out.results, aiSkipped: out.aiSkipped, generatedBy: context.identity.email });
  } catch (generationError) {
    return error(500, 'generation_failed', 'Unable to generate posts', { message: generationError.message });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendNodeResponse(methodNotAllowed(ALLOWED_METHODS), res);
  }
  const headers = nodeHeadersToWebHeaders(req.headers);
  const body = nodeRequestBodyToString(req);
  const requestUrl = nodeRequestUrl(req, headers, 'thebigsisterfoundation.org');
  const request = new Request(requestUrl.toString(), { method: 'POST', headers: headers, body: body });
  return sendNodeResponse(await POST(request), res);
}
