import { readFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://thebigsisterfoundation.org';
const STATIC_PAGES = [
  { loc: '/', changefreq: 'daily', priority: '1.0' },
  { loc: '/volunteer/', changefreq: 'weekly', priority: '0.8' },
  { loc: '/scholars/', changefreq: 'weekly', priority: '0.8' },
  { loc: '/ledger/', changefreq: 'weekly', priority: '0.7' },
  { loc: '/ideas/', changefreq: 'weekly', priority: '0.7' },
  { loc: '/donate/', changefreq: 'weekly', priority: '0.9' },
  { loc: '/sponsor/', changefreq: 'weekly', priority: '0.8' },
  { loc: '/blog/', changefreq: 'daily', priority: '0.8' },
  { loc: '/events/', changefreq: 'weekly', priority: '0.7' },
  { loc: '/forums/', changefreq: 'weekly', priority: '0.6' },
  { loc: '/docs/', changefreq: 'monthly', priority: '0.5' },
  { loc: '/manifesto/', changefreq: 'monthly', priority: '0.7' }
];

function escapeXml(value) {
  return String(value || '').replace(/[<>&'"]/g, function (char) {
    return {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      "'": '&apos;',
      '"': '&quot;'
    }[char];
  });
}

function readPosts() {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'data', 'ai-posts.json'), 'utf-8'));
  } catch (e) {
    try {
      return JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'ai-posts.json'), 'utf-8'));
    } catch (e2) {
      return [];
    }
  }
}

function buildBlogPostLoc(postId) {
  return BASE_URL + '/blog/?post=' + encodeURIComponent(String(postId || ''));
}

export default function handler(req, res) {
  const posts = readPosts();
  const today = new Date().toISOString().split('T')[0];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  STATIC_PAGES.forEach(function (page) {
    xml += '  <url>\n';
    xml += '    <loc>' + escapeXml(BASE_URL + page.loc) + '</loc>\n';
    xml += '    <lastmod>' + today + '</lastmod>\n';
    xml += '    <changefreq>' + page.changefreq + '</changefreq>\n';
    xml += '    <priority>' + page.priority + '</priority>\n';
    xml += '  </url>\n';
  });

  if (Array.isArray(posts)) {
    posts.forEach(function (post) {
      if (!post || post.id === undefined || post.id === null || post.id === '') return;
      xml += '  <url>\n';
      xml += '    <loc>' + escapeXml(buildBlogPostLoc(post.id)) + '</loc>\n';
      xml += '    <lastmod>' + escapeXml(post.date || today) + '</lastmod>\n';
      xml += '    <changefreq>monthly</changefreq>\n';
      xml += '    <priority>0.6</priority>\n';
      xml += '  </url>\n';
    });
  }

  xml += '</urlset>';

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
  return res.status(200).send(xml);
}
