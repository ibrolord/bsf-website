// Consolidated XML endpoints (feed + sitemap) — one function instead of two.
// Reached via rewrites: /feed.xml -> /api/xml/feed, /sitemap.xml -> /api/xml/sitemap.
// Handlers live in ./_handlers/ (an underscore dir Vercel does not treat as functions).
import feed from './_handlers/feed.js';
import sitemap from './_handlers/sitemap.js';

const HANDLERS = { feed, sitemap };

export default async function handler(req, res) {
  const target = HANDLERS[(req.query && req.query.type) || ''];
  if (!target) {
    res.status(404).json({ error: 'Unknown xml type' });
    return;
  }
  return target(req, res);
}
