// ═══════════════════════════════════════════════════════════════
//  BSF BLOG ORCHESTRATOR — Multi-AI SEO Content Pipeline
//
//  Pipeline: Research → Analyze → Write → Review → Publish
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
//  Final  (Claude):      Incorporates review feedback, produces
//          publish-ready content
// ═══════════════════════════════════════════════════════════════

const GITHUB_REPO = 'ibrolord/threatgenix';
const POSTS_FILE_PATH = 'TrashShit/claudecode/VNtranscript/public/data/ai-posts.json';
const BRANCH = 'feat/bsf-website';

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
  'breaking poverty cycle Nigeria', 'children future leaders Lagos', 'invest in children Africa'
];

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

Create a detailed outline with:
1. SEO-optimized title (50-65 chars, must include primary keyword)
2. Meta description (150-160 chars, include primary keyword, compelling)
3. H2 and H3 heading structure (4-6 sections, keywords in headings naturally)
4. For each section: 2-3 bullet points of what to cover
5. Internal linking opportunities (suggest linking to /scholars/, /volunteer/, /events/, /ledger/)
6. Call-to-action recommendation
7. Recommended word count per section

Respond in JSON:
{
  "title": "",
  "metaDescription": "",
  "sections": [
    {"heading": "", "level": "h2", "points": [], "wordCount": 150, "keywords_to_include": []}
  ],
  "internal_links": [{"anchor_text": "", "url": ""}],
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
async function writeWithClaude(research, outline) {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return null;

  const validation = research?.validation || {};
  const recommended = research?.recommended || {};

  const prompt = `You are the head writer for Big Sister Foundation, a nonprofit in Lagos, Nigeria that invests in vulnerable children — not as recipients, but as future leaders who lift their communities.

${outline ? `CONTENT OUTLINE TO FOLLOW:
${JSON.stringify(outline, null, 2)}` : ''}

SEO RESEARCH CONTEXT:
- Primary keyword: "${recommended.primary_keyword || 'child welfare Lagos Nigeria'}"
- Secondary keywords: ${(recommended.secondary_keywords || ['vulnerable children Lagos', 'nonprofit Nigeria']).join(', ')}
- Content gaps to fill: ${(research?.content_gaps || []).join('; ')}
- Emotional angle: ${validation.emotional_angle || 'empowerment'}
- Category: ${validation.category || 'insight'}

WRITING RULES:
- Follow the outline structure if provided, using the exact headings
- Include primary keyword in: title, first paragraph, one H2 heading, last paragraph
- Include each secondary keyword 1-2 times naturally
- 700-900 words total
- Short paragraphs (2-4 sentences max)
- BSF voice: direct, warm, honest. No jargon. No saviour language.
- Reference real Lagos neighborhoods: Makoko, Surulere, Ajegunle, Victoria Island, Ikeja
- Use specific details — names (fictional but realistic Yoruba/Igbo names), numbers, places
- Include natural internal links as markdown: [text](/path/)
- Separate paragraphs with \\n\\n
- Do NOT use markdown headings (##) — just write flowing paragraphs with natural section breaks

AUTHOR: ${validation.category === 'story' ? 'Funke Adeyemi' : validation.category === 'guide' ? 'Amara Okafor' : validation.category === 'update' ? 'BSF Team' : 'Bolaji Agunbiade'}

Respond in JSON only:
{
  "title": "${outline?.title || ''}",
  "excerpt": "1-2 sentences, 120-160 chars, include primary keyword",
  "metaDescription": "${outline?.metaDescription || '150-160 chars with primary keyword'}",
  "body": "full post text, paragraphs separated by \\n\\n",
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
        max_tokens: 2500,
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
async function reviewWithOpenAI(draft) {
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
          content: `You are an SEO quality reviewer. Analyze this blog post and provide improvement suggestions.

BLOG POST:
Title: ${draft.title}
Keywords: ${(draft.keywords || []).join(', ')}
Body: ${draft.body}

Evaluate:
1. SEO SCORE (1-100): keyword placement, density, title optimization, meta description
2. READABILITY SCORE (1-100): sentence length variety, paragraph structure, flow
3. KEYWORD DENSITY: is primary keyword used enough but not stuffed?
4. TITLE EFFECTIVENESS: would this get clicks from search results?
5. SPECIFIC FIXES: list 2-3 concrete improvements (rewording, keyword additions, structural changes)

Respond in JSON:
{
  "seo_score": 85,
  "readability_score": 90,
  "keyword_density_ok": true,
  "title_score": 8,
  "fixes": [
    {"type": "keyword", "suggestion": "Add primary keyword to paragraph 3"},
    {"type": "readability", "suggestion": "Break up the second paragraph"}
  ],
  "improved_title": "alternative title suggestion if score < 7",
  "improved_meta": "improved meta description if needed",
  "overall_verdict": "publish" or "needs_revision"
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
        max_tokens: 2500,
        messages: [{
          role: 'user',
          content: `Revise this blog post based on the SEO review feedback. Keep the same voice and style.

CURRENT POST:
${JSON.stringify(draft, null, 2)}

REVIEW FEEDBACK:
${JSON.stringify(review, null, 2)}

Apply the suggested fixes. ${review.improved_title ? `Consider using this title: "${review.improved_title}"` : ''}
${review.improved_meta ? `Use this meta description: "${review.improved_meta}"` : ''}

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
    const validated = await validateWithGrok(research || { recommended: { topic: KEYWORD_UNIVERSE[Math.floor(Math.random() * KEYWORD_UNIVERSE.length)], primary_keyword: KEYWORD_UNIVERSE[Math.floor(Math.random() * KEYWORD_UNIVERSE.length)] } });
    pipeline.push('validation_complete');

    // ── STAGE 3: Content Outline (Gemini) ──
    pipeline.push('outline_started');
    const outline = await outlineWithGemini(validated);
    pipeline.push(outline ? 'outline_complete' : 'outline_skipped');

    // ── STAGE 4: Write Content (Claude) ──
    pipeline.push('writing_started');
    const draft = await writeWithClaude(validated, outline);
    if (!draft) return res.status(500).json({ error: 'Content generation failed', pipeline });
    pipeline.push('writing_complete');

    // ── STAGE 5: Quality Review (OpenAI) ──
    pipeline.push('review_started');
    const review = await reviewWithOpenAI(draft);
    pipeline.push(review ? 'review_complete' : 'review_skipped');

    // ── STAGE 6: Final Polish (Claude) ──
    pipeline.push('final_pass_started');
    const finalPost = await finalPassClaude(draft, review);
    pipeline.push('final_pass_complete');

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
      seoScore: review?.seo_score || null,
      readabilityScore: review?.readability_score || null
    };

    // ── Persist ──
    const allPosts = [newPost, ...existingPosts].slice(0, 50);

    if (sha) {
      await updateGitHubFile(allPosts, sha);
      pipeline.push('published_to_github');
    }

    return res.status(200).json({
      success: true,
      post: { title: newPost.title, category: newPost.category, seoScore: newPost.seoScore, readabilityScore: newPost.readabilityScore },
      pipeline,
      totalPosts: allPosts.length
    });

  } catch (error) {
    return res.status(500).json({ error: error.message, pipeline });
  }
}

export const config = {
  maxDuration: 60
};
