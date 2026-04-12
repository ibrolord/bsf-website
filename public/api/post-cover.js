import { findRealtimeCoverImage } from './_lib/openverse.js';

async function isUsableImageUrl(url) {
  if (!url) return false;
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    const contentType = String(response.headers.get('content-type') || '');
    return response.ok && contentType.indexOf('image/') === 0;
  } catch (error) {
    return false;
  }
}

export default async function handler(req, res) {
  const title = String(req.query.title || '');
  const category = String(req.query.category || 'insight');
  const keyword = String(req.query.keyword || '');
  const keywords = String(req.query.keywords || '');
  const preferred = String(req.query.preferred || '');

  const fallbackParams = new URLSearchParams({
    title,
    category,
    author: 'Big Sister Foundation',
    keyword
  });
  const fallbackUrl = '/api/og-image?' + fallbackParams.toString();

  try {
    if (preferred && await isUsableImageUrl(preferred)) {
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
      res.setHeader('X-BSF-Cover-Source', 'preferred');
      res.writeHead(302, { Location: preferred });
      res.end();
      return;
    }

    const image = await findRealtimeCoverImage({ title, category, keyword, keywords });
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('X-BSF-Cover-Source', image ? 'openverse' : 'og-fallback');
    res.writeHead(302, { Location: image && image.thumbnail ? image.thumbnail : fallbackUrl });
    res.end();
  } catch (error) {
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
    res.writeHead(302, { Location: fallbackUrl });
    res.end();
  }
}
