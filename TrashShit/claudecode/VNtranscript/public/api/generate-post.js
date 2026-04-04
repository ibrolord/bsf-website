// ═══════════════════════════════════════════════════════════════
//  BSF BLOG ORCHESTRATOR — Multi-AI SEO Content Pipeline v3
//
//  Pipeline: Cluster → Research → Validate → Outline → Write →
//            Review → Enforce → Interlink → Snippet → Publish → Track
//
//  NEW in v3:
//  - Topic clustering: pillar + cluster architecture
//  - Featured snippet targeting: formats for Position 0
//  - Cross-post interlinking: new posts link to old, old updated to link back
//  - Post-publish rank tracking: weekly checks via Perplexity
// ═══════════════════════════════════════════════════════════════

const GITHUB_REPO = 'ibrolord/threatgenix';
const POSTS_FILE_PATH = 'TrashShit/claudecode/VNtranscript/public/data/ai-posts.json';
const BRANCH = 'feat/bsf-website';

// ═══ SEO ENFORCEMENT CONFIG ═══
const SEO_CONFIG = {
  minSeoScore: 70,
  minReadabilityScore: 65,
  minWordCount: 650,
  maxWordCount: 1200,
  minKeywordDensity: 0.8,
  maxKeywordDensity: 2.5,
  requiredInternalLinks: 2,
  requiredCrossPostLinks: 1,      // link to at least 1 existing blog post
  maxRetries: 2,
  titleMinLength: 40,
  titleMaxLength: 70,
  metaDescMinLength: 120,
  metaDescMaxLength: 165,
  requiredKeywordPlacements: ['title', 'firstParagraph', 'lastParagraph'],
  snippetRequired: true,           // must include a featured snippet block
};

// ═══ TOPIC CLUSTERS ═══
// Each pillar has a core topic and cluster subtopics. The system rotates
// through clusters ensuring topical authority depth before moving on.
const TOPIC_CLUSTERS = [
  {
    pillar: 'Child Education in Lagos',
    pillarKeyword: 'child education Lagos',
    clusters: [
      { topic: 'scholarship programs for children in Lagos', keywords: ['scholarship programs Lagos', 'free education Lagos', 'school fees Nigeria'] },
      { topic: 'after-school programs for vulnerable children Lagos', keywords: ['after school programs Lagos', 'tutoring children Lagos', 'homework help Nigeria'] },
      { topic: 'girls education challenges in Nigeria', keywords: ['girls education Nigeria', 'female education barriers Lagos', 'gender gap education Africa'] },
      { topic: 'best schools for low-income families in Lagos', keywords: ['affordable schools Lagos', 'community schools Nigeria', 'public education Lagos'] },
      { topic: 'how to support out-of-school children in Nigeria', keywords: ['out of school children Nigeria', 'education access Nigeria', 'child enrollment Lagos'] },
    ]
  },
  {
    pillar: 'Volunteering with Children in Lagos',
    pillarKeyword: 'volunteer with children Lagos',
    clusters: [
      { topic: 'how to volunteer with children in Lagos Nigeria', keywords: ['volunteer opportunities Lagos', 'community service Lagos', 'volunteer Nigeria children'] },
      { topic: 'mentorship programs for youth in Lagos', keywords: ['mentorship programs youth Nigeria', 'youth mentoring Lagos', 'mentor disadvantaged children'] },
      { topic: 'what to expect when volunteering at a Nigerian nonprofit', keywords: ['volunteer Nigeria nonprofit', 'NGO volunteer guide', 'first time volunteer Africa'] },
      { topic: 'weekend volunteer activities for families in Lagos', keywords: ['family volunteering Lagos', 'community service families Nigeria', 'weekend volunteer Lagos'] },
      { topic: 'skills-based volunteering for Nigerian nonprofits', keywords: ['skills volunteering Nigeria', 'pro bono Lagos nonprofit', 'tech volunteer Africa'] },
    ]
  },
  {
    pillar: 'Child Welfare and Protection in Nigeria',
    pillarKeyword: 'child welfare Nigeria',
    clusters: [
      { topic: 'child protection laws in Nigeria explained', keywords: ['child protection Nigeria', 'child rights act Nigeria', 'child safety laws Lagos'] },
      { topic: 'how nonprofits are breaking poverty cycles in Lagos', keywords: ['breaking poverty cycle Nigeria', 'poverty alleviation Lagos', 'children future leaders Lagos'] },
      { topic: 'community-based child welfare programs in Lagos', keywords: ['community development Lagos', 'grassroots organizations Nigeria', 'Makoko Lagos community'] },
      { topic: 'ethical approaches to child sponsorship in Africa', keywords: ['child sponsorship alternatives', 'ethical child support Africa', 'dignity-centered aid'] },
      { topic: 'women-led nonprofits changing child welfare in Nigeria', keywords: ['women-led nonprofits Africa', 'female founders NGO Nigeria', 'sisterhood community support'] },
    ]
  },
  {
    pillar: 'Nonprofit Transparency in Africa',
    pillarKeyword: 'nonprofit transparency Africa',
    clusters: [
      { topic: 'how to verify a Nigerian nonprofit is legitimate', keywords: ['NGO accountability Nigeria', 'transparent charity Africa', 'nonprofit Nigeria donate'] },
      { topic: 'open ledger model for African nonprofits', keywords: ['nonprofit transparency Africa', 'financial transparency NGO', 'open books charity Nigeria'] },
      { topic: 'where your donation goes at a Lagos nonprofit', keywords: ['donation tracking Nigeria', 'impact reporting nonprofit', 'charity accountability Lagos'] },
      { topic: 'social enterprise vs charity model in Nigeria', keywords: ['social enterprise Nigeria', 'sustainable development Lagos', 'nonprofit sustainability Africa'] },
      { topic: 'investing in children as future community leaders', keywords: ['invest in children Africa', 'youth empowerment Lagos', 'children future leaders Lagos'] },
    ]
  }
];

// Flat keyword universe (derived from clusters + extras)
const KEYWORD_UNIVERSE = [
  ...new Set(TOPIC_CLUSTERS.flatMap(c => [c.pillarKeyword, ...c.clusters.flatMap(cl => cl.keywords)]))
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

    if (!res.ok) throw new Error('Grok API error: ' + res.status);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    const jsonMatch = text?.match(/\{[\s\S]*\}/);
    return jsonMatch ? { ...research, validation: JSON.parse(jsonMatch[0]) } : research;
  } catch (e) {
    console.error('Grok error, trying OpenAI fallback:', e.message);
    // Fallback: use OpenAI for trend validation
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) return research;
    try {
      const fbRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: `You are a trend validation agent for a Nigerian nonprofit blog. Validate this SEO research.

RESEARCH: ${JSON.stringify(research, null, 2)}

Rate confidence 1-10, identify emotional angle, suggest headline, pick category (story/update/insight/guide).

Respond in JSON:
{"confidence":8,"timeliness_boost":"","emotional_angle":"","headline_suggestion":"","category":"","enhanced_keywords":[],"social_signals":""}`
          }]
        })
      });
      if (!fbRes.ok) return research;
      const fbData = await fbRes.json();
      const fbText = fbData.choices?.[0]?.message?.content;
      const fbMatch = fbText?.match(/\{[\s\S]*\}/);
      return fbMatch ? { ...research, validation: JSON.parse(fbMatch[0]) } : research;
    } catch (fbErr) {
      console.error('OpenAI validation fallback error:', fbErr.message);
      return research;
    }
  }
}

// ═══ Agent 3: Gemini — Content Outline (fallback: OpenAI) ═══
async function outlineWithGemini(research) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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

    if (!res.ok) throw new Error('Gemini API error: ' + res.status);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const jsonMatch = text?.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error('Gemini returned no valid JSON');
  } catch (e) {
    console.error('Gemini error, trying OpenAI fallback:', e.message);
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) return null;
    try {
      const fbRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: `Create an SEO blog outline for a Nigerian nonprofit. Topic: ${recommended.topic || 'child welfare Lagos'}. Primary keyword: ${recommended.primary_keyword || 'child welfare Lagos'}. Need: title 40-70 chars with keyword, meta 120-165 chars, 4-6 H2 sections, 3+ internal links to /scholars/ /volunteer/ /donate/. Respond in JSON: {"title":"","metaDescription":"","sections":[{"heading":"","level":"h2","points":[],"wordCount":150,"keywords_to_include":[]}],"internal_links":[{"anchor_text":"","url":""}],"cta":"","total_word_count":800}` }]
        })
      });
      if (!fbRes.ok) return null;
      const fbData = await fbRes.json();
      const fbText = fbData.choices?.[0]?.message?.content;
      const fbMatch = fbText?.match(/\{[\s\S]*\}/);
      return fbMatch ? JSON.parse(fbMatch[0]) : null;
    } catch (fbErr) {
      console.error('OpenAI outline fallback error:', fbErr.message);
      return null;
    }
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

// ═══ TOPIC CLUSTER SELECTOR ═══
// Picks the next cluster topic based on what's already been covered.
// Ensures depth within a pillar before moving to the next.
function selectClusterTopic(existingPosts) {
  const coveredKeywords = new Set();
  (existingPosts || []).forEach(p => {
    (p.keywords || []).forEach(k => coveredKeywords.add(k.toLowerCase()));
    if (p.seoMetrics?.cluster) coveredKeywords.add(p.seoMetrics.cluster.toLowerCase());
  });

  // Score each cluster: lower = less covered = higher priority
  const scored = [];
  TOPIC_CLUSTERS.forEach(pillar => {
    pillar.clusters.forEach(cluster => {
      const covered = cluster.keywords.filter(k => coveredKeywords.has(k.toLowerCase())).length;
      const score = covered / cluster.keywords.length; // 0 = untouched, 1 = fully covered
      scored.push({ pillar: pillar.pillar, pillarKeyword: pillar.pillarKeyword, cluster, score });
    });
  });

  // Sort by least covered first, with some randomness among low-scored items
  scored.sort((a, b) => a.score - b.score);
  // Pick from the top 5 least-covered with some randomness
  const candidates = scored.slice(0, 5);
  const pick = candidates[Math.floor(Math.random() * candidates.length)];

  return {
    pillar: pick.pillar,
    pillarKeyword: pick.pillarKeyword,
    topic: pick.cluster.topic,
    primary_keyword: pick.cluster.keywords[0],
    secondary_keywords: pick.cluster.keywords.slice(1),
    cluster_coverage: pick.score
  };
}

// ═══ CROSS-POST INTERLINKING ═══
// Finds 2-3 existing posts related to the new post's keywords and
// injects links. Also returns suggestions for updating old posts.
function buildCrossPostLinks(newPost, existingPosts) {
  const newKeywords = (newPost.keywords || []).map(k => k.toLowerCase());
  const newBody = (newPost.body || '').toLowerCase();

  // Score existing posts by keyword overlap
  const scored = (existingPosts || []).map(post => {
    const postKeywords = (post.keywords || []).map(k => k.toLowerCase());
    const overlap = postKeywords.filter(k => newKeywords.some(nk => nk.includes(k) || k.includes(nk))).length;
    const titleRelevance = newKeywords.some(k => (post.title || '').toLowerCase().includes(k)) ? 2 : 0;
    return { post, score: overlap + titleRelevance };
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);

  const linksToAdd = scored.slice(0, 3).map(s => ({
    postId: s.post.id,
    title: s.post.title,
    anchor: s.post.title,
    url: `/blog/?post=${s.post.id}`
  }));

  // Check if links already exist in body
  const missingLinks = linksToAdd.filter(l => !newBody.includes(`/blog/?post=${l.postId}`));

  // Build reverse links: suggest updating old posts to link to this new one
  const reverseLinks = scored.slice(0, 2).map(s => ({
    oldPostId: s.post.id,
    oldPostTitle: s.post.title,
    suggestedAnchor: newPost.title,
    suggestedUrl: `/blog/?post=${newPost.id}`
  }));

  return { linksToAdd: missingLinks, reverseLinks };
}

// Inject cross-post links into the post body
function injectCrossPostLinks(body, links) {
  if (!links || links.length === 0) return body;

  const paragraphs = body.split('\n\n');
  if (paragraphs.length < 4) return body;

  // Add a "Related reading" section before the last paragraph
  const relatedLinks = links.map(l => `- [${l.anchor}](${l.url})`).join('\n');
  const relatedSection = `### Related Reading\n\n${relatedLinks}`;

  // Insert before the last paragraph
  paragraphs.splice(paragraphs.length - 1, 0, relatedSection);
  return paragraphs.join('\n\n');
}

// Update old posts with reverse links (returns updated posts array)
function applyReverseLinks(existingPosts, reverseLinks) {
  if (!reverseLinks || reverseLinks.length === 0) return { posts: existingPosts, updated: 0 };

  let updated = 0;
  const posts = existingPosts.map(post => {
    const match = reverseLinks.find(r => r.oldPostId === post.id);
    if (!match) return post;
    if ((post.body || '').includes(match.suggestedUrl)) return post; // already linked

    const paragraphs = (post.body || '').split('\n\n');
    if (paragraphs.length < 3) return post;

    // Add link naturally near the end
    const linkText = `\n\nFor more on this topic, read [${match.suggestedAnchor}](${match.suggestedUrl}).`;
    paragraphs[paragraphs.length - 2] += linkText;
    updated++;
    return { ...post, body: paragraphs.join('\n\n') };
  });

  return { posts, updated };
}

// ═══ FEATURED SNIPPET FORMATTER ═══
// Adds a snippet-optimized section targeting Google's Position 0
function ensureSnippetBlock(body, primaryKeyword) {
  // Check if a snippet block already exists
  if (body.includes('**Quick Answer:**') || body.includes('**Key Takeaway:**')) return body;

  const paragraphs = body.split('\n\n');
  if (paragraphs.length < 4) return body;

  // Find the most relevant paragraph (one mentioning the keyword)
  const kwLower = (primaryKeyword || '').toLowerCase();
  let bestIdx = 1; // default to second paragraph
  for (let i = 1; i < paragraphs.length - 1; i++) {
    if (paragraphs[i].toLowerCase().includes(kwLower) && !paragraphs[i].startsWith('#')) {
      bestIdx = i;
      break;
    }
  }

  // Create a concise snippet block (40-60 words, direct answer format)
  const sourceParagraph = paragraphs[bestIdx];
  const sentences = sourceParagraph.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const snippetText = sentences.slice(0, 2).join('. ').trim();

  if (snippetText.length < 50) return body; // not enough content for a snippet

  const snippetBlock = `> **Quick Answer:** ${snippetText}.`;

  // Insert after the first H2 heading or after the first paragraph
  let insertIdx = 1;
  for (let i = 0; i < paragraphs.length; i++) {
    if (paragraphs[i].startsWith('## ')) { insertIdx = i + 1; break; }
  }

  paragraphs.splice(insertIdx, 0, snippetBlock);
  return paragraphs.join('\n\n');
}

// ═══ POST-PUBLISH RANK TRACKER ═══
// Checks ranking position for published posts via Perplexity
async function checkRankings(existingPosts) {
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
  if (!PERPLEXITY_API_KEY) return null;

  // Only check posts from the last 30 days that have keywords
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const recentPosts = (existingPosts || [])
    .filter(p => p.id > thirtyDaysAgo && p.keywords && p.keywords.length > 0)
    .slice(0, 5); // check max 5 per run

  if (recentPosts.length === 0) return null;

  const queries = recentPosts.map(p => ({
    id: p.id,
    title: p.title,
    keyword: p.keywords[0]
  }));

  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PERPLEXITY_API_KEY}` },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{
          role: 'user',
          content: `For each of these search queries, check if "Big Sister Foundation" or "bigsisterfoundation" appears in the top 20 search results. Report the approximate position (1-20) or "not found".

Queries to check:
${queries.map((q, i) => `${i + 1}. "${q.keyword}" — looking for article titled "${q.title}"`).join('\n')}

Respond in JSON:
{
  "rankings": [
    {"keyword": "...", "position": 5, "found": true, "competing_content": "who ranks above us"},
    {"keyword": "...", "position": null, "found": false, "competing_content": "top 3 results"}
  ],
  "recommendations": "what keywords to focus on next based on ranking data"
}`
        }]
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    const jsonMatch = text?.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const rankings = JSON.parse(jsonMatch[0]);

    // Attach rankings to posts
    const postRankings = {};
    (rankings.rankings || []).forEach((r, i) => {
      if (queries[i]) {
        postRankings[queries[i].id] = {
          keyword: r.keyword,
          position: r.position,
          found: r.found,
          checkedAt: new Date().toISOString()
        };
      }
    });

    return { postRankings, recommendations: rankings.recommendations };
  } catch (e) {
    console.error('Rank check error:', e.message);
    return null;
  }
}

// Apply rank data to posts
function applyRankData(posts, rankData) {
  if (!rankData || !rankData.postRankings) return posts;

  return posts.map(post => {
    const ranking = rankData.postRankings[post.id];
    if (!ranking) return post;

    const history = post.rankHistory || [];
    history.push(ranking);
    // Keep last 12 rank checks (3 months of weekly checks)
    if (history.length > 12) history.shift();

    return { ...post, rankHistory: history, lastRankCheck: ranking };
  });
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

    // ── STAGE 0: Topic Cluster Selection ──
    pipeline.push('cluster_selection');
    const clusterTopic = selectClusterTopic(existingPosts);
    measurements.cluster = {
      pillar: clusterTopic.pillar,
      topic: clusterTopic.topic,
      coverage: clusterTopic.cluster_coverage
    };
    pipeline.push(`cluster_selected: ${clusterTopic.pillar} → ${clusterTopic.topic}`);

    // ── STAGE 1: SEO Research (Perplexity) — informed by cluster ──
    pipeline.push('research_started');
    const research = await researchWithPerplexity(existingTitles);
    // Merge cluster data into research — cluster takes priority for topic direction
    const enrichedResearch = research || {};
    if (!enrichedResearch.recommended) enrichedResearch.recommended = {};
    // Only override if Perplexity didn't return strong results
    if (!enrichedResearch.recommended.primary_keyword) {
      enrichedResearch.recommended.topic = clusterTopic.topic;
      enrichedResearch.recommended.primary_keyword = clusterTopic.primary_keyword;
      enrichedResearch.recommended.secondary_keywords = clusterTopic.secondary_keywords;
    }
    pipeline.push(research ? 'research_complete' : 'research_skipped_using_cluster');

    // ── STAGE 2: Trend Validation (Grok) ──
    pipeline.push('validation_started');
    const validated = await validateWithGrok(enrichedResearch);
    pipeline.push('validation_complete');

    const primaryKeyword = validated?.recommended?.primary_keyword || clusterTopic.primary_keyword;

    // ── STAGE 3: Content Outline (Gemini → fallback to Claude) ──
    pipeline.push('outline_started');
    let outline = await outlineWithGemini(validated);
    if (!outline) {
      // Fallback: generate a basic outline from the cluster topic
      pipeline.push('outline_gemini_failed_using_fallback');
      const kw = primaryKeyword || clusterTopic.primary_keyword;
      outline = {
        title: `${clusterTopic.topic.charAt(0).toUpperCase() + clusterTopic.topic.slice(1)}`,
        metaDescription: `Learn about ${kw} and how Big Sister Foundation is making a difference in Lagos, Nigeria.`,
        sections: [
          { heading: `Understanding ${kw}`, level: 'h2', points: ['Define the issue', 'Scale in Lagos'], wordCount: 150, keywords_to_include: [kw] },
          { heading: 'The Reality on the Ground', level: 'h2', points: ['Real examples', 'Community perspective'], wordCount: 150, keywords_to_include: [] },
          { heading: 'What Big Sister Foundation Does', level: 'h2', points: ['Programs', 'Impact numbers'], wordCount: 200, keywords_to_include: [kw] },
          { heading: 'How You Can Help', level: 'h2', points: ['Volunteer', 'Donate', 'Spread awareness'], wordCount: 150, keywords_to_include: [] },
        ],
        internal_links: [
          { anchor_text: 'volunteer with us', url: '/volunteer/' },
          { anchor_text: 'meet our scholars', url: '/scholars/' },
          { anchor_text: 'support the foundation', url: '/donate/' },
        ],
        cta: 'Join our volunteer community or make a donation today.',
        total_word_count: 800
      };
    }
    pipeline.push(outline ? 'outline_complete' : 'outline_skipped');

    // ── STAGE 4: Write Content (Claude → fallback to OpenAI) ──
    let draft = null;
    let compliance = null;
    let retryCount = 0;
    let retryFeedback = null;
    let writerUsed = 'claude';

    while (retryCount <= SEO_CONFIG.maxRetries) {
      pipeline.push(`writing_attempt_${retryCount + 1}`);
      draft = await writeWithClaude(validated, outline, retryFeedback);

      // Fallback: if Claude fails, try OpenAI as backup writer
      if (!draft && process.env.OPENAI_API_KEY) {
        pipeline.push('claude_writer_failed_trying_openai');
        writerUsed = 'openai_fallback';
        try {
          const fallbackRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [{
                role: 'user',
                content: `Write a 750-word SEO blog post for Big Sister Foundation, a nonprofit in Lagos Nigeria.
Topic: ${validated?.recommended?.topic || clusterTopic.topic}
Primary keyword: "${primaryKeyword}" (must appear in title, first paragraph, one H2, last paragraph)
Use ## for H2 headings (4-6 total). Include 3+ internal links as [text](/path/) to /scholars/, /volunteer/, /donate/.
Voice: warm, direct, honest. No saviour language. Reference real Lagos neighborhoods.
Respond in JSON: {"title":"","excerpt":"","metaDescription":"","body":"","author":"BSF Team","category":"insight","keywords":["${primaryKeyword}"],"readTime":4}`
              }]
            })
          });
          if (fallbackRes.ok) {
            const fbData = await fallbackRes.json();
            const fbText = fbData.choices?.[0]?.message?.content;
            const fbMatch = fbText?.match(/\{[\s\S]*\}/);
            if (fbMatch) draft = JSON.parse(fbMatch[0]);
          }
        } catch (e) { console.error('OpenAI fallback writer error:', e.message); }
      }

      if (!draft) return res.status(500).json({ error: 'All writers failed (Claude + OpenAI fallback)', pipeline, measurements });

      compliance = checkSeoCompliance(draft, primaryKeyword);
      measurements[`attempt_${retryCount + 1}`] = { ...compliance.metrics, writer: writerUsed };

      if (compliance.compliant) {
        pipeline.push(`compliance_passed_attempt_${retryCount + 1}`);
        break;
      }

      pipeline.push(`compliance_failed_attempt_${retryCount + 1}: ${compliance.issues.length} issues`);
      retryFeedback = compliance.issues;
      retryCount++;
    }

    // ── STAGE 5: Quality Review (OpenAI → fallback to compliance-only) ──
    pipeline.push('review_started');
    let review = await reviewWithOpenAI(draft, compliance);

    if (!review) {
      // Fallback: use our own compliance checker as the review
      pipeline.push('openai_review_failed_using_compliance_fallback');
      review = {
        seo_score: compliance.metrics.computedSeoScore,
        readability_score: compliance.metrics.avgSentenceLength <= 25 ? 80 : 60,
        keyword_density_ok: compliance.metrics.keywordDensity >= SEO_CONFIG.minKeywordDensity && compliance.metrics.keywordDensity <= SEO_CONFIG.maxKeywordDensity,
        word_count: compliance.metrics.wordCount,
        fixes: compliance.issues.map(i => ({ type: 'compliance', priority: 'high', suggestion: i })),
        overall_verdict: compliance.compliant ? 'publish' : 'needs_revision',
        verdict_reason: compliance.compliant ? 'Passed automated compliance' : `${compliance.issues.length} compliance issues remain`,
        fallback: true
      };
    }

    measurements.openai_seo_score = review.seo_score;
    measurements.openai_readability_score = review.readability_score;
    measurements.openai_verdict = review.overall_verdict;
    measurements.review_source = review.fallback ? 'compliance_fallback' : 'openai';
    pipeline.push(review.fallback ? 'review_fallback_complete' : 'review_complete');

    // ── STAGE 6: Final Polish (Claude — skipped if using fallback writer) ──
    pipeline.push('final_pass_started');
    const finalPost = (writerUsed === 'claude') ? await finalPassClaude(draft, review) : draft;
    pipeline.push('final_pass_complete');

    // ── Post-polish degradation check ──
    // If the final polish made the post WORSE, revert to the best draft
    const prePolishCompliance = checkSeoCompliance(draft, primaryKeyword);
    const postPolishCompliance = checkSeoCompliance(finalPost, primaryKeyword);
    if (postPolishCompliance.metrics.computedSeoScore < prePolishCompliance.metrics.computedSeoScore - 10) {
      pipeline.push('polish_degraded_reverting: ' + postPolishCompliance.metrics.computedSeoScore + ' < ' + prePolishCompliance.metrics.computedSeoScore);
      // Revert to pre-polish draft
      finalPost.title = draft.title;
      finalPost.body = draft.body;
      finalPost.excerpt = draft.excerpt;
      finalPost.metaDescription = draft.metaDescription;
      finalPost.keywords = draft.keywords;
    }

    // ── STAGE 7: Featured Snippet Injection ──
    pipeline.push('snippet_injection');
    finalPost.body = ensureSnippetBlock(finalPost.body, primaryKeyword);

    // ── STAGE 8: Cross-Post Interlinking ──
    pipeline.push('cross_linking');
    const tempPost = { ...finalPost, id: Date.now() };
    const crossLinks = buildCrossPostLinks(tempPost, existingPosts);
    finalPost.body = injectCrossPostLinks(finalPost.body, crossLinks.linksToAdd);
    measurements.crossPostLinks = crossLinks.linksToAdd.length;
    measurements.reverseLinksToApply = crossLinks.reverseLinks.length;

    // ── Final compliance check ──
    const finalCompliance = checkSeoCompliance(finalPost, primaryKeyword);
    measurements.final = finalCompliance.metrics;

    // ── Score gate ──
    const seoScore = review?.seo_score || finalCompliance.metrics.computedSeoScore;
    const readScore = review?.readability_score || 70;

    if (seoScore < SEO_CONFIG.minSeoScore) {
      return res.status(422).json({
        error: `Post rejected: SEO score ${seoScore} below minimum ${SEO_CONFIG.minSeoScore}`,
        pipeline, measurements,
        issues: finalCompliance.issues,
        draft: { title: finalPost.title, seoScore, readabilityScore: readScore }
      });
    }

    // ── Build OG image URL ──
    const ogParams = new URLSearchParams({
      title: finalPost.title || '',
      category: finalPost.category || 'insight',
      author: finalPost.author || 'Big Sister Foundation',
      keyword: primaryKeyword || ''
    });
    const ogImage = `/api/og-image?${ogParams.toString()}`;

    // ── Build post object ──
    const newPost = {
      id: tempPost.id,
      title: finalPost.title,
      category: finalPost.category,
      author: finalPost.author,
      date: new Date().toISOString().split('T')[0],
      excerpt: finalPost.excerpt,
      body: finalPost.body,
      readTime: finalPost.readTime || Math.ceil((finalPost.body || '').split(/\s+/).length / 220),
      keywords: finalPost.keywords,
      metaDescription: finalPost.metaDescription,
      ogImage: ogImage,
      aiGenerated: true,
      seoScore: seoScore,
      readabilityScore: readScore,
      seoMetrics: {
        ...finalCompliance.metrics,
        complianceIssues: finalCompliance.issues,
        retryCount,
        cluster: clusterTopic.pillar,
        clusterTopic: clusterTopic.topic,
        crossPostLinks: crossLinks.linksToAdd.length,
        hasSnippetBlock: (finalPost.body || '').includes('**Quick Answer:**'),
        primaryKeyword
      }
    };

    // ── STAGE 9: Rank Tracking (skipped in main pipeline — runs separately) ──
    pipeline.push('rank_tracking_deferred');
    const rankData = null; // deferred to separate cron
    let updatedExisting = existingPosts;
    if (rankData) {
      updatedExisting = applyRankData(existingPosts, rankData);
      measurements.rankingsChecked = Object.keys(rankData.postRankings || {}).length;
      measurements.rankRecommendations = rankData.recommendations;
      pipeline.push(`rankings_checked: ${measurements.rankingsChecked} posts`);
    } else {
      pipeline.push('rank_tracking_skipped');
    }

    // ── STAGE 10: Apply reverse links to old posts ──
    const { posts: interlinkedPosts, updated: reverseLinksApplied } = applyReverseLinks(updatedExisting, crossLinks.reverseLinks);
    measurements.reverseLinksApplied = reverseLinksApplied;
    if (reverseLinksApplied > 0) pipeline.push(`reverse_links_applied: ${reverseLinksApplied} old posts updated`);

    // ── Persist ──
    const allPosts = [newPost, ...interlinkedPosts].slice(0, 50);

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
        cluster: clusterTopic.pillar,
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
  maxDuration: 300
};
