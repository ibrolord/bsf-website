import { readAiPosts } from './_lib/ai-posts.js';

export default async function handler(req, res) {
  const BASE_URL = 'https://thebigsisterfoundation.org';

  // Static pages
  const staticPages = [
    { loc: '/', changefreq: 'daily', priority: '1.0' },
    { loc: '/volunteer/', changefreq: 'weekly', priority: '0.8' },
    { loc: '/scholars/', changefreq: 'weekly', priority: '0.8' },
    { loc: '/ledger/', changefreq: 'weekly', priority: '0.7' },
    { loc: '/ideas/', changefreq: 'weekly', priority: '0.7' },
    { loc: '/donate/', changefreq: 'weekly', priority: '0.9' },
    { loc: '/sponsor/', changefreq: 'weekly', priority: '0.8' },
    { loc: '/volunteer/register/', changefreq: 'monthly', priority: '0.5' },
    { loc: '/blog/', changefreq: 'daily', priority: '0.8' },
  ];

  const posts = await readAiPosts();

  const today = new Date().toISOString().split('T')[0];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Add static pages
  staticPages.forEach(function(page) {
    xml += '  <url>\n';
    xml += '    <loc>' + BASE_URL + page.loc + '</loc>\n';
    xml += '    <lastmod>' + today + '</lastmod>\n';
    xml += '    <changefreq>' + page.changefreq + '</changefreq>\n';
    xml += '    <priority>' + page.priority + '</priority>\n';
    xml += '  </url>\n';
  });

  // Add blog posts
  posts.forEach(function(post) {
    xml += '  <url>\n';
    xml += '    <loc>' + BASE_URL + '/blog/?post=' + post.id + '</loc>\n';
    xml += '    <lastmod>' + (post.date || today) + '</lastmod>\n';
    xml += '    <changefreq>monthly</changefreq>\n';
    xml += '    <priority>0.6</priority>\n';
    xml += '  </url>\n';
  });

  xml += '</urlset>';

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
  return res.status(200).send(xml);
}
