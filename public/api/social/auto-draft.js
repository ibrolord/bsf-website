// ═══════════════════════════════════════════════════════════════
//  /api/social/auto-draft — scheduled autopilot drafter (cron)
//
//  Runs on a Vercel cron (see public/vercel.json). Each run:
//    1. picks an evergreen, on-brand BSF topic (rotates weekly),
//    2. generates an Instagram + Facebook + X post for it,
//    3. saves them as a draft group into social_posts.
//
//  Nothing publishes — drafts land in the Approval queue for a human to
//  approve and post. This is the "set it and forget it" half of the tool:
//  auto-draft → human approve → human post.
//
//  Auth: Bearer CRON_SECRET (mirrors generate-post.js). Firestore writes
//  use the configured automation identity (BSF_AUTOMATION_EMAIL/PASSWORD),
//  which must hold a role/permission allowing social_posts creation.
// ═══════════════════════════════════════════════════════════════

import { getAutomationActor } from '../_lib/auth.js';
import { generateForPlatforms } from './generate.js';
import { createSocialPost } from './posts.js';

// Evergreen prompts grounded in BSF's pillars + transparency model.
const EVERGREEN_TOPICS = [
  'A reminder that you are not alone — how Big Sister Foundation shows up, steadily, for families in Lagos.',
  'Why we map every donation to a named child on a public ledger, so trust is demonstrated and not just asked for.',
  'What "community-level raisers" means to us, and why we invest in children to become the ones who raise their communities.',
  'A spotlight on a child in our Gifted Potential pathway — high-performing, under-resourced, and full of promise.',
  'How our Special Needs pathway opens up care, adaptive education, and community for children too often left out.',
  'Meeting families where they are: support for children from difficult backgrounds, without judgement.',
  'An honest invitation to volunteer with children in Lagos — what it really looks like to show up.',
  'Transparency you can verify, not trust you are asked to give: a look at how our open ledger works.'
];

// Pick a topic that rotates roughly weekly (deterministic from the date).
function pickTopic(now) {
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const week = Math.floor((now - startOfYear) / (7 * 24 * 60 * 60 * 1000));
  return EVERGREEN_TOPICS[week % EVERGREEN_TOPICS.length];
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const topic = pickTopic(new Date());

  let actor;
  try {
    actor = await getAutomationActor('social-auto-draft');
  } catch (authError) {
    const status = authError && authError.status ? authError.status : 500;
    return res.status(status).json({ ok: false, error: authError.message || 'Automation identity unavailable' });
  }

  try {
    const source = { type: 'topic', title: topic, text: '', refId: '' };
    const { results, aiSkipped } = await generateForPlatforms({
      source,
      platforms: ['instagram', 'facebook', 'twitter'],
      tone: ''
    });

    let groupId;
    const created = [];
    for (const r of results) {
      const post = {
        platform: r.platform,
        caption: r.caption,
        hashtags: r.hashtags,
        card: r.card,
        source,
        aiGenerated: r.model !== 'fallback',
        aiModel: r.model
      };
      // First create mints the shared groupId; the rest reuse it.
      const result = await createSocialPost(actor, post, groupId);
      groupId = result.groupId;
      created.push(result);
    }

    return res.status(200).json({
      ok: true,
      topic,
      groupId,
      created: created.length,
      aiSkipped,
      message: `Drafted ${created.length} posts into the approval queue.`
    });
  } catch (draftError) {
    console.error(JSON.stringify({ area: 'social-auto-draft', code: 'failed', message: draftError.message }));
    return res.status(500).json({ ok: false, error: 'Auto-draft failed', message: draftError.message });
  }
}
