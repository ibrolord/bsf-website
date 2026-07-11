// Consolidated image endpoints (og-image + post-cover) — one function instead of two.
// Reached via rewrites: /api/og-image -> /api/media/og, /api/post-cover -> /api/media/cover
// (old URLs preserved so existing og:image share links keep working).
import og from './_handlers/og.js';
import cover from './_handlers/cover.js';

const HANDLERS = { og, cover };

export default async function handler(req, res) {
  const target = HANDLERS[(req.query && req.query.kind) || ''];
  if (!target) {
    res.status(404).json({ error: 'Unknown media kind' });
    return;
  }
  return target(req, res);
}
