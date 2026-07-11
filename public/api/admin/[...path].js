// Consolidated admin endpoints (mutate + team-member + blog/review) — one catch-all
// function instead of three. Serves /api/admin/mutate, /api/admin/team-member, and
// /api/admin/blog/review; handlers live in ./_handlers/ (an underscore dir Vercel does
// not treat as functions). Same URLs, no frontend changes.
import mutate from './_handlers/mutate.js';
import teamMember from './_handlers/team-member.js';
import blogReview from './_handlers/blog-review.js';

const HANDLERS = {
  'mutate': mutate,
  'team-member': teamMember,
  'blog/review': blogReview,
};

export default async function handler(req, res) {
  const seg = req.query && req.query.path;
  const key = Array.isArray(seg) ? seg.join('/') : String(seg || '');
  const target = HANDLERS[key];
  if (!target) {
    res.status(404).json({ error: `Unknown admin route: ${key}` });
    return;
  }
  return target(req, res);
}
