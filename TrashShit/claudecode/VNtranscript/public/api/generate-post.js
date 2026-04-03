// ═══════════════════════════════════════════════════════════════
//  BSF BLOG ORCHESTRATOR — Multi-AI SEO Content Pipeline v2
//
//  Pipeline: Research → Validate → Outline → Write → Review → Enforce → Publish
//
//  Agent 1 (Perplexity): Real-time SEO research — trending topics,
//          competitor analysis, keyword gaps, search intent
//  Agent 2 (Grok):       Trend validation — confirms relevance,
//          checks social signals, identifies angles
//  Agent 3 (Gemini):     Content outline — structures the post
//          for maximum SEO impact with proper headings
//  Agent 4 (Claude):     Writes the final post — long-form,
//          on-brand, SEO-optimized, human-quality content
//  Agent 5 (OpenAI):     Quality review — checks SEO score,
//          readability, keyword density, suggests improvements
//  Agent 6 (Claude):     Incorporates review feedback
//  Gate:                 SEO Compliance Check — enforces minimums
// ═══════════════════════════════════════════════════════════════

const GITHUB_REPO = 'ibrolord/threatgenix';
const POSTS_FILE_PATH = 'TrashShit/claudecode/VNtranscript/public/data/ai-posts.json';
const BRANCH = 'feat/bsf-website';

// ═══ SEO ENFORCEMENT CONFIG ═══
const SEO_CONFIG = {
  minSeoScore: 70,              // reject posts below this
  minReadabilityScore: 65,      // reject posts below this
  minWordCount: 650,            // minimum words
  maxWordCount: 1200,           // maximum words
  minKeywordDensity: 0.8,       // primary keyword min % of total words
  maxKeywordDensity: 2.5,       // primary keyword max % (avoid stuffing)
  requiredInternalLinks: 2,     // minimum internal links
  maxRetries: 2,                // how many times to retry if below minimums
  titleMinLength: 40,
  titleMaxLength: 70,
  metaDescMinLength: 120,
  metaDescMaxLength: 165,
  requiredKeywordPlacements: ['title', 'firstParagraph', 'lastParagraph'],
};

// Core keyword universe for Big Sister Foundation
const KEYWORD_UNIVERSE = [
  'child welfare Lagos Nigeria', 'vulnerable children Lagos', 'child protection Nigeria',
  'nonprofit transparency Africa', 'NGO accountability Nigeria', 'transparent charity Africa',
  'volunteer opportunities Lagos', 'community service Lagos Nigeria', 'volunteer Nigeria children',
  'education access Nigeria', 'out of school children Nigeria', 'scholarship programs Lagos',
  'mentorship programs youth Nigeria', 'youth mentoring Lagos', 'mentor disadvantaged children',
  'community development Lagos', 'grassroots organizations Nigeria', 'Makoko Lagos community',
  'child sponsorship alternatives', 'ethical child support Africa', 'dignity-centered aid',
  'women-led nonprofits Africa', 'female founders NGO Nigeria', 'sisterhood community support',
  'Lagos poverty alleviation', 'child education Lagos', 'Nigeria social impact',
  'community outreach Lagos', 'child safety Lagos', 'nonprofit Nigeria donate',
  'breaking poverty cycle Nigeria', 'children future leaders Lagos', 'invest in children Africa',
  'Lagos children education fund', 'child mentoring Africa', 'girls education Nigeria',
  'youth empowerment Lagos', 'social enterprise Nigeria', 'sustainable development Lagos children'
];

// ═══ SEO COMPLIANCE CHECKER ═══
function checkSeoCompliance(post, primaryKeyword) {
  const issues = [];
  const metrics = {};
  const body = post.body || '';
  const words = body.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const title = post.title || '';
  const meta = post.metaDescription || '';
  const lowerBody = body.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const keyword = (primaryKeyword || '').toLowerCase();

  // Word count
  metrics.wordCount = wordCount;
  if (wordCount < SEO_CONFIG.minWordCount) issues.push(`Word count ${wordCount} below minimum ${SEO_CONFIG.minWordCount}`);
  if (wordCount > SEO_CONFIG.maxWordCount) issues.push(`Word count ${wordCount} above maximum ${SEO_CONFIG.maxWordCount}`);

  // Title length
  metrics.titleLength = title.length;
  if (title.length < SEO_CONFIG.titleMinLength) issues.push(`Title too short (${title.length} chars, need ${SEO_CONFIG.titleMinLength}+)`);
  if (title.length > SEO_CONFIG.titleMaxLength) issues.push(`Title too long (${title.length} chars, max ${SEO_CONFIG.titleMaxLength})`);

  // Meta description length
  metrics.metaDescLength = meta.length;
  if (meta.length < SEO_CONFIG.metaDescMinLength) issues.push(`Meta description too short (${meta.length} chars, need ${SEO_CONFIG.metaDescMinLength}+)`);
  if (meta.length > SEO_CONFIG.metaDescMaxLength) issues.push(`Meta description too long (${meta.length} chars, max ${SEO_CONFIG.metaDescMaxLength})`);

  // Keyword density
  if (keyword) {
    const keywordCount = (lowerBody.match(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
    const density = (keywordCount / wordCount) * 100;
    metrics.keywordDensity = Math.round(density * 100) / 100;
    metrics.keywordCount = keywordCount;
    if (density < SEO_CONFIG.minKeywordDensity) issues.push(`Keyword density ${density.toFixed(2)}% below minimum ${SEO_CONFIG.minKeywordDensity}%`);
    if (density > SEO_CONFIG.maxKeywordDensity) issues.push(`Keyword density ${density.toFixed(2)}% above maximum (stuffing) ${SEO_CONFIG.maxKeywordDensity}%`);

    // Keyword placement checks
    metrics.keywordInTitle = lowerTitle.includes(keyword);
    if (!metrics.keywordInTitle) issues.push('Primary keyword missing from title');

    const paragraphs = body.split(/\n\n+/).filter(p => p.trim().length > 0);
    metrics.keywordInFirstParagraph = paragraphs.length > 0 && paragraphs[0].toLowerCase().includes(keyword);
    if (!metrics.keywordInFirstParagraph) issues.push('Primary keyword missing from first paragraph');

    metrics.keywordInLastParagraph = paragraphs.length > 0 && paragraphs[paragraphs.length - 1].toLowerCase().includes(keyword);
    if (!metrics.keywordInLastParagraph) issues.push('Primary keyword missing from last paragraph');

    metrics.keywordInMeta = meta.toLowerCase().includes(keyword);
    if (!metrics.keywordInMeta) issues.push('Primary keyword missing from meta description');
  }

  // Internal links
  const internalLinks = (body.match(/\]\(\//g) || []).length;
  metrics.internalLinkCount = internalLinks;
  if (internalLinks < SEO_CONFIG.requiredInternalLinks) issues.push(`Only ${internalLinks} internal links (need ${SEO_CONFIG.requiredInternalLinks}+)`);

  // Heading structure (## headings)
  const h2Count = (body.match(/^## /gm) || []).length;
  const h3Count = (body.match(/^### /gm) || []).length;
  metrics.h2Count = h2Count;
  metrics.h3Count = h3Count;
  if (h2Count < 3) issues.push(`Only ${h2Count} H2 headings (need 3+ for SEO structure)`);

  // Readability: sentence length
  const sentences = body.replace(/\n/g, ' ').split(/[.!?]+/).filter(s => s.trim().length > 5);
  const avgSentenceLength = sentences.length > 0 ? Math.round(words.length / sentences.length) : 0;
  metrics.avgSentenceLength = avgSentenceLength;
  if (avgSentenceLength > 25) issues.push(`Average sentence length ${avgSentenceLength} words is too long (aim for <25)`);

  // Paragraph length
  const paragraphs = body.split(/\n\n+/).filter(p => p.trim().length > 0);
  const longParagraphs = paragraphs.filter(p => p.split(/\s+/).length > 80);
  metrics.longParagraphs = longParagraphs.length;
  if (longParagraphs.length > 0) issues.push(`${longParagraphs.length} paragraphs are too long (80+ words)`);

  // Compute our own SEO score
  let score = 100;
  score -= issues.length * 8; // each issue costs 8 points
  if (!metrics.keywordInTitle) score -= 10;
  if (!metrics.keywordInFirstParagraph) score -= 8;
  if (h2Count < 3) score -= 10;
  if (internalLinks < 2) score -= 8;
  metrics.computedSeoScore = Math.max(0, Math.min(100, score));

  return { compliant: issues.length === 0, issues, metrics };
}

// ═══ Agent 1: Perplexity — SEO Research ═══
async function researchWithPerplexity(existingTitles) {
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
  if (!PERPLEXITY_API_KEY) return null;

  const randomKeywords = KEYWORD_UNIVERSE
    .sort(() => Math.random() - 0.5)
    .slice(0, 5)
    .join(', ');

  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PERPLEXITY_API_KEY}` },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{
          role: 'user',
          content: `You are an SEO research agent for a nonprofit called Big Sister Foundation in Lagos, Nigeria that helps vulnerable children.

Research the current search landscape for these keyword areas: ${randomKeywords}

Find me:
1. TOP 3 trending topics right now in child welfare / education / nonprofit space in Nigeria/Africa that people are actively searching for
2. For each topic: estimated search volume (high/medium/low), competition level, and search intent (informational/transactional/navigational)
3. CONTENT GAPS — what questions are people asking that have poor quality answers currently?
4. COMPETITOR CONTENT — what are similar nonprofits (e.g., Save the Children Nigeria, SOS Children Villages, Slum2School) publishing that ranks well?
5. RECOMMENDED ANGLE — one specific blog post topic that would have the best chance of ranking, with primary keyword and 3-4 secondary keywords

EXISTING TITLES TO AVOID (do not suggest anything similar):
${existingTitles || 'None'}

Respond in JSON format:
{
  "trending_topics": [{"topic": "", "volume": "", "competition": "", "intent": ""}],
  "content_gaps": ["question1", "question2", "question3"],
  "competitor_insights": "brief summary",
  "recommended": {
    "topic": "",
    "primary_keyword": "",
    "secondary_keywords": [],
    "angle": "",
    "search_intent": "",
    "estimated_difficulty": ""
  }
}`
        }]
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    const jsonMatch = text?.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (e) {
    console.error('Perplexity error:', e.message);
    return null;
  }
}

// ═══ Agent 2: Grok — Trend Validation ═══
async function validateWithGrok(research) {
  const GROK_API_KEY = process.env.GROK_API_KEY;
  if (!GROK_API_KEY || !research) return research;

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROK_API_KEY}` },
      body: JSON.stringify({
        model: 'grok-3-mini-fast',
        messages: [{
          role: 'user',
          content: `You are a trend validation agent. Given this SEO research for a Nigerian nonprofit blog, validate and enhance it.

RESEARCH DATA:
${JSON.stringify(research, null, 2)}

Check:
1. Is the recommended topic actually trending or relevant right now? Rate confidence 1-10.
2. Are there any current events, news, or social media conversations that make this topic more timely?
3. What emotional angle would resonate most with readers (hope, urgency, empowerment, outrage)?
4. Suggest a compelling headline angle that would get clicks AND be honest (no clickbait).
5. What is the ideal category for this post: "story", "update", "insight", or "guide"?

Respond in JSON:
{
  "confidence": 8,
  "timeliness_boost": "explanation of why now is good timing",
  "emotional_angle": "",
  "headline_suggestion": "",
  "category": "",
  "enhanced_keywords": [],
  "social_signals": "what people are saying about this"
}`
        }]
      })
    });

    if (!res.ok) return research;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    const jsonMatch = text?.match(/\{[\s\S]*\}/);
    return jsonMatch ? { ...research, validation: JSON.parse(jsonMatch[0]) } : research;
  } catch (e) {
    console.error('Grok error:', e.message);
    return research;
  }
}

// ═══ Agent 3: Gemini — Content Outline ═══
async function outlineWithGemini(research) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return null;

  const validation = research.validation || {};
  const recommended = research.recommended || {};

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are an SEO content strategist. Create a detailed blog post outline optimized for search rankings.

TOPIC: ${recommended.topic || 'child welfare in Lagos Nigeria'}
PRIMARY KEYWORD: ${recommended.primary_keyword || 'child welfare Lagos'}
SECONDARY KEYWORDS: ${(recommended.secondary_keywords || []).join(', ')}
CATEGORY: ${validation.category || 'insight'}
EMOTIONAL ANGLE: ${validation.emotional_angle || 'empowerment'}
SEARCH INTENT: ${recommended.search_intent || 'informational'}

STRICT SEO REQUIREMENTS:
- Title MUST be 40-70 characters and MUST contain the primary keyword
- Meta description MUST be 120-165 characters and MUST contain the primary keyword
- MUST have 4-6 H2 sections (these will be ## headings in markdown)
- Primary keyword MUST appear in at least 2 H2 headings naturally
- MUST include 3+ internal link opportunities to /scholars/, /volunteer/, /donate/, /ledger/, /ideas/
- Total word count target: 750-1000 words

Create the outline with:
1. SEO-optimized title (40-70 chars, MUST include primary keyword)
2. Meta description (120-165 chars, MUST include primary keyword, compelling CTA)
3. H2 and H3 heading structure (4-6 sections, primary keyword in 2+ headings)
4. For each section: 2-3 bullet points of what to cover + target word count
5. Internal linking plan (minimum 3 links with anchor text)
6. Call-to-action recommendation
7. Keyword placement map showing where primary and secondary keywords go

Respond in JSON:
{
  "title": "",
  "metaDescription": "",
  "sections": [
    {"heading": "", "level": "h2", "points": [], "wordCount": 150, "keywords_to_include": []}
  ],
  "internal_links": [{"anchor_text": "", "url": ""}],
  "keyword_placement_map": {
    "title": true,
    "meta": true,
    "first_paragraph": true,
    "headings": ["which headings contain keyword"],
    "last_paragraph": true
  },
  "cta": "",
  "total_word_count": 800
}`
            }]
          }]
        })
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const jsonMatch = text?.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (e) {
    console.error('Gemini error:', e.message);
    return null;
  }
}

// ═══ Agent 4: Claude — Content Writer ═══
async function writeWithClaude(research, outline, retryFeedback) {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return null;

  const validation = research?.validation || {};
  const recommended = research?.recommended || {};

  const retryInstructions = retryFeedback ? `

CRITICAL: Your previous draft FAILED SEO compliance. Fix these issues:
${retryFeedback.join('\n- ')}

You MUST fix ALL of these issues in this revision.` : '';

  const prompt = `You are the head writer for Big Sister Foundation, a nonprofit in Lagos, Nigeria that invests in vulnerable children — not as recipients, but as future leaders who lift their communities.

${outline ? `CONTENT OUTLINE TO FOLLOW:
${JSON.stringify(outline, null, 2)}` : ''}

SEO RESEARCH CONTEXT:
- Primary keyword: "${recommended.primary_keyword || 'child welfare Lagos Nigeria'}"
- Secondary keywords: ${(recommended.secondary_keywords || ['vulnerable children Lagos', 'nonprofit Nigeria']).join(', ')}
- Content gaps to fill: ${(research?.content_gaps || []).join('; ')}
- Emotional angle: ${validation.emotional_angle || 'empowerment'}
- Category: ${validation.category || 'insight'}

STRICT SEO RULES (non-negotiable):
1. Use ## for H2 headings and ### for H3 headings — this is REQUIRED for SEO structure
2. Include 4-6 ## H2 headings throughout the post
3. Primary keyword MUST appear in: title, first paragraph, at least one ## heading, last paragraph, meta description
4. Each secondary keyword must appear 1-2 times naturally
5. 750-1000 words total (count carefully)
6. Include at least 3 internal links as markdown: [anchor text](/path/) linking to /scholars/, /volunteer/, /donate/, /ledger/, or /ideas/
7. Short paragraphs (2-4 sentences max)
8. Meta description: 120-165 characters, includes primary keyword, has a call-to-action

VOICE & STYLE:
- BSF voice: direct, warm, honest. No jargon. No saviour language.
- Reference real Lagos neighborhoods: Makoko, Surulere, Ajegunle, Victoria Island, Ikeja
- Use specific details — names (fictional but realistic Yoruba/Igbo names), numbers, places
- Separate paragraphs with \\n\\n
${retryInstructions}

AUTHOR: ${validation.category === 'story' ? 'Funke Adeyemi' : validation.category === 'guide' ? 'Amara Okafor' : validation.category === 'update' ? 'BSF Team' : 'Bolaji Agunbiade'}

Respond in JSON only:
{
  "title": "40-70 chars, includes primary keyword",
  "excerpt": "1-2 sentences, 120-160 chars, include primary keyword",
  "metaDescription": "120-165 chars with primary keyword and CTA",
  "body": "full post text with ## headings, paragraphs separated by \\n\\n, internal links as [text](/path/)",
  "author": "author name",
  "category": "${validation.category || 'insight'}",
  "keywords": ["primary", "secondary1", "secondary2"],
  "readTime": estimated_minutes
}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (e) {
    console.error('Claude error:', e.message);
    return null;
  }
}

// ═══ Agent 5: OpenAI — Quality Review ═══
async function reviewWithOpenAI(draft, complianceReport) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY || !draft) return null;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `You are a strict SEO quality reviewer. Analyze this blog post and score it rigorously.

BLOG POST:
Title: ${draft.title}
Keywords: ${(draft.keywords || []).join(', ')}
Meta Description: ${draft.metaDescription || ''}
Body:
${draft.body}

AUTOMATED COMPLIANCE REPORT:
${JSON.stringify(complianceReport, null, 2)}

Evaluate STRICTLY:
1. SEO SCORE (1-100): keyword placement (title, H2s, first/last paragraph), density (0.8-2.5%), title length (40-70 chars), meta description (120-165 chars with keyword), heading structure (4+ H2s), internal links (3+)
2. READABILITY SCORE (1-100): sentence length (<25 avg), paragraph length (<80 words), flow, transitions
3. KEYWORD DENSITY: calculate exact percentage — is primary keyword used 0.8-2.5% of total words?
4. TITLE EFFECTIVENESS: does it include the keyword? Is it 40-70 chars? Would it get clicks?
5. HEADING STRUCTURE: are there 4+ H2 headings? Do 2+ contain the primary keyword?
6. INTERNAL LINKS: are there 3+ links to /scholars/, /volunteer/, /donate/, /ledger/, /ideas/?
7. SPECIFIC FIXES: list ALL concrete improvements needed

Be strict. A score of 85+ should mean the post is genuinely excellent for SEO.

Respond in JSON:
{
  "seo_score": 85,
  "readability_score": 90,
  "keyword_density_ok": true,
  "keyword_density_pct": 1.2,
  "title_score": 8,
  "heading_score": 9,
  "internal_link_count": 3,
  "word_count": 820,
  "fixes": [
    {"type": "keyword", "priority": "high", "suggestion": "Add primary keyword to paragraph 3"},
    {"type": "readability", "priority": "medium", "suggestion": "Break up the second paragraph"}
  ],
  "improved_title": "alternative title if score < 7",
  "improved_meta": "improved meta description if needed",
  "overall_verdict": "publish" or "needs_revision",
  "verdict_reason": "why this verdict"
}`
        }]
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    const jsonMatch = text?.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (e) {
    console.error('OpenAI review error:', e.message);
    return null;
  }
}

// ═══ Final Pass: Claude — Incorporate Feedback ═══
async function finalPassClaude(draft, review) {
  if (!review || review.overall_verdict === 'publish') return draft;

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return draft;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: `Revise this blog post based on the SEO review feedback. Keep the same voice and style.

CURRENT POST:
${JSON.stringify(draft, null, 2)}

REVIEW FEEDBACK:
${JSON.stringify(review, null, 2)}

STRICT REQUIREMENTS:
- Apply ALL suggested fixes
- Ensure 4+ ## H2 headings are present
- Ensure 3+ internal links as [text](/path/)
- Ensure primary keyword is in: title, first paragraph, one H2, last paragraph, meta description
- Keep word count between 750-1000
${review.improved_title ? `- Use this title: "${review.improved_title}"` : ''}
${review.improved_meta ? `- Use this meta description: "${review.improved_meta}"` : ''}

Return the complete revised post in the same JSON format:
{
  "title": "...",
  "excerpt": "...",
  "metaDescription": "...",
  "body": "...",
  "author": "${draft.author}",
  "category": "${draft.category}",
  "keywords": ${JSON.stringify(draft.keywords)},
  "readTime": ${draft.readTime}
}`
        }]
      })
    });

    if (!res.ok) return draft;
    const data = await res.json();
    const text = data.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : draft;
  } catch (e) {
    return draft;
  }
}

// ═══ GitHub Persistence ═══
async function getGitHubFile() {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) return { content: [], sha: null };

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${POSTS_FILE_PATH}?ref=${BRANCH}`,
    { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
  );
  if (!res.ok) return { content: [], sha: null };
  const data = await res.json();
  const content = JSON.parse(Buffer.from(data.content, 'base64').toString());
  return { content, sha: data.sha };
}

async function updateGitHubFile(posts, sha) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) return false;

  const encoded = Buffer.from(JSON.stringify(posts, null, 2)).toString('base64');
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${POSTS_FILE_PATH}`,
    {
      method: 'PUT',
      headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `blog: auto-generate SEO post — ${new Date().toISOString().split('T')[0]}`,
        content: encoded,
        sha,
        branch: BRANCH
      })
    }
  );
  return res.ok;
}

// ═══ MAIN ORCHESTRATOR ═══
export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const pipeline = [];
  const measurements = {};

  try {
    // Load existing posts
    const { content: existingPosts, sha } = await getGitHubFile();
    const existingTitles = existingPosts.map(p => p.title).join('\n');

    // ── STAGE 1: SEO Research (Perplexity) ──
    pipeline.push('research_started');
    const research = await researchWithPerplexity(existingTitles);
    pipeline.push(research ? 'research_complete' : 'research_skipped');

    // ── STAGE 2: Trend Validation (Grok) ──
    pipeline.push('validation_started');
    const validated = await validateWithGrok(research || {
      recommended: {
        topic: KEYWORD_UNIVERSE[Math.floor(Math.random() * KEYWORD_UNIVERSE.length)],
        primary_keyword: KEYWORD_UNIVERSE[Math.floor(Math.random() * KEYWORD_UNIVERSE.length)]
      }
    });
    pipeline.push('validation_complete');

    const primaryKeyword = validated?.recommended?.primary_keyword || '';

    // ── STAGE 3: Content Outline (Gemini) ──
    pipeline.push('outline_started');
    const outline = await outlineWithGemini(validated);
    pipeline.push(outline ? 'outline_complete' : 'outline_skipped');

    // ── STAGE 4: Write Content (Claude) — with retry loop ──
    let draft = null;
    let compliance = null;
    let retryCount = 0;
    let retryFeedback = null;

    while (retryCount <= SEO_CONFIG.maxRetries) {
      pipeline.push(`writing_attempt_${retryCount + 1}`);
      draft = await writeWithClaude(validated, outline, retryFeedback);
      if (!draft) return res.status(500).json({ error: 'Content generation failed', pipeline, measurements });

      // ── SEO Compliance Check ──
      compliance = checkSeoCompliance(draft, primaryKeyword);
      measurements[`attempt_${retryCount + 1}`] = compliance.metrics;

      if (compliance.compliant) {
        pipeline.push(`compliance_passed_attempt_${retryCount + 1}`);
        break;
      }

      pipeline.push(`compliance_failed_attempt_${retryCount + 1}: ${compliance.issues.length} issues`);
      retryFeedback = compliance.issues;
      retryCount++;
    }

    // ── STAGE 5: Quality Review (OpenAI) ──
    pipeline.push('review_started');
    const review = await reviewWithOpenAI(draft, compliance);
    pipeline.push(review ? 'review_complete' : 'review_skipped');

    if (review) {
      measurements.openai_seo_score = review.seo_score;
      measurements.openai_readability_score = review.readability_score;
      measurements.openai_verdict = review.overall_verdict;
    }

    // ── STAGE 6: Final Polish (Claude) ──
    pipeline.push('final_pass_started');
    const finalPost = await finalPassClaude(draft, review);
    pipeline.push('final_pass_complete');

    // ── Final compliance check ──
    const finalCompliance = checkSeoCompliance(finalPost, primaryKeyword);
    measurements.final = finalCompliance.metrics;

    // ── Score gate: reject if below minimums ──
    const seoScore = review?.seo_score || finalCompliance.metrics.computedSeoScore;
    const readScore = review?.readability_score || 70;

    if (seoScore < SEO_CONFIG.minSeoScore) {
      return res.status(422).json({
        error: `Post rejected: SEO score ${seoScore} below minimum ${SEO_CONFIG.minSeoScore}`,
        pipeline,
        measurements,
        issues: finalCompliance.issues,
        draft: { title: finalPost.title, seoScore, readabilityScore: readScore }
      });
    }

    // ── Build post object ──
    const newPost = {
      id: Date.now(),
      title: finalPost.title,
      category: finalPost.category,
      author: finalPost.author,
      date: new Date().toISOString().split('T')[0],
      excerpt: finalPost.excerpt,
      body: finalPost.body,
      readTime: finalPost.readTime || Math.ceil((finalPost.body || '').split(/\s+/).length / 220),
      keywords: finalPost.keywords,
      metaDescription: finalPost.metaDescription,
      aiGenerated: true,
      seoScore: seoScore,
      readabilityScore: readScore,
      // Measurement data
      seoMetrics: {
        wordCount: finalCompliance.metrics.wordCount,
        keywordDensity: finalCompliance.metrics.keywordDensity,
        keywordInTitle: finalCompliance.metrics.keywordInTitle,
        keywordInFirstParagraph: finalCompliance.metrics.keywordInFirstParagraph,
        keywordInLastParagraph: finalCompliance.metrics.keywordInLastParagraph,
        keywordInMeta: finalCompliance.metrics.keywordInMeta,
        h2Count: finalCompliance.metrics.h2Count,
        internalLinkCount: finalCompliance.metrics.internalLinkCount,
        avgSentenceLength: finalCompliance.metrics.avgSentenceLength,
        titleLength: finalCompliance.metrics.titleLength,
        metaDescLength: finalCompliance.metrics.metaDescLength,
        complianceIssues: finalCompliance.issues,
        retryCount: retryCount
      }
    };

    // ── Persist ──
    const allPosts = [newPost, ...existingPosts].slice(0, 50);

    if (sha) {
      await updateGitHubFile(allPosts, sha);
      pipeline.push('published_to_github');
    }

    return res.status(200).json({
      success: true,
      post: {
        title: newPost.title,
        category: newPost.category,
        seoScore: newPost.seoScore,
        readabilityScore: newPost.readabilityScore,
        seoMetrics: newPost.seoMetrics
      },
      pipeline,
      measurements,
      totalPosts: allPosts.length
    });

  } catch (error) {
    return res.status(500).json({ error: error.message, pipeline, measurements });
  }
}

export const config = {
  maxDuration: 120
};
