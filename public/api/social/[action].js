// Consolidated social API router.
//
// Vercel's Hobby plan caps a deployment at 12 Serverless Functions. The four
// social endpoints (card, generate, posts, auto-draft) used to be four separate
// functions. This single dynamic route serves every /api/social/<action> path
// and dispatches to the original handlers in ./_handlers/ (an underscore-prefixed
// directory Vercel does NOT treat as functions). Same URLs, one function.
import cardHandler from './_handlers/card.js';
import generateHandler from './_handlers/generate.js';
import postsHandler from './_handlers/posts.js';
import autoDraftHandler from './_handlers/auto-draft.js';

const HANDLERS = {
  card: cardHandler,
  generate: generateHandler,
  posts: postsHandler,
  'auto-draft': autoDraftHandler,
};

export default async function handler(req, res) {
  const action = (req.query && req.query.action) || '';
  const target = HANDLERS[action];
  if (!target) {
    res.status(404).json({ error: `Unknown social action: ${action}` });
    return;
  }
  return target(req, res);
}
