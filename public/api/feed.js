import { readAiPosts, sortPostsByDateDesc } from './_lib/ai-posts.js';

export default async function handler(req, res) {
  const BASE_URL = 'https://thebigsisterfoundation.org';

  let posts = sortPostsByDateDesc(await readAiPosts()).slice(0, 20);

  function escapeXml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n';
  xml += '  <channel>\n';
  xml += '    <title>Big Sister Foundation Blog</title>\n';
  xml += '    <link>' + BASE_URL + '/blog/</link>\n';
  xml += '    <description>Stories, updates, and insights from Big Sister Foundation. Read about our work with vulnerable children in Lagos and the communities we serve.</description>\n';
  xml += '    <language>en</language>\n';
  xml += '    <atom:link href="' + BASE_URL + '/api/feed" rel="self" type="application/rss+xml" />\n';

  posts.forEach(function(post) {
    var postUrl = BASE_URL + '/blog/?post=' + post.id;
    var pubDate = new Date(post.date).toUTCString();

    xml += '    <item>\n';
    xml += '      <title>' + escapeXml(post.title) + '</title>\n';
    xml += '      <link>' + postUrl + '</link>\n';
    xml += '      <guid>' + postUrl + '</guid>\n';
    xml += '      <description>' + escapeXml(post.excerpt || post.metaDescription || '') + '</description>\n';
    xml += '      <pubDate>' + pubDate + '</pubDate>\n';
    xml += '      <author>' + escapeXml(post.author || 'Big Sister Foundation') + '</author>\n';
    xml += '    </item>\n';
  });

  xml += '  </channel>\n';
  xml += '</rss>';

  res.setHeader('Content-Type', 'application/rss+xml');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
  return res.status(200).send(xml);
}
