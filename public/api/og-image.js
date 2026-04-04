// ═══ Dynamic OG Image Generator for BSF Blog Posts ═══
// Generates branded SVG social share images per blog post
// Usage: /api/og-image?title=Post+Title&category=insight&author=Name

export default function handler(req, res) {
  const title = (req.query.title || 'Big Sister Foundation').slice(0, 80);
  const category = (req.query.category || 'insight').toLowerCase();
  const author = (req.query.author || 'Big Sister Foundation').slice(0, 40);
  const keyword = (req.query.keyword || '').slice(0, 50);

  // Category colors
  const categoryColors = {
    story: { bg: '#C2734C', label: 'STORY' },
    update: { bg: '#2D5E40', label: 'UPDATE' },
    insight: { bg: '#D4A96A', label: 'INSIGHT' },
    guide: { bg: '#8BAF8E', label: 'GUIDE' },
  };
  const cat = categoryColors[category] || categoryColors.insight;

  // Word-wrap title into lines (max ~30 chars per line)
  const words = title.split(' ');
  const lines = [];
  let currentLine = '';
  words.forEach(word => {
    if ((currentLine + ' ' + word).trim().length > 30) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = (currentLine + ' ' + word).trim();
    }
  });
  if (currentLine.trim()) lines.push(currentLine.trim());
  const titleLines = lines.slice(0, 3); // max 3 lines

  // Build title text elements
  const titleY = titleLines.length === 1 ? 260 : titleLines.length === 2 ? 230 : 210;
  const titleSvg = titleLines.map((line, i) => {
    // Escape XML special characters
    const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return `<text x="80" y="${titleY + i * 52}" fill="#FFF8F0" font-family="Georgia, 'Times New Roman', serif" font-size="44" font-weight="600">${escaped}</text>`;
  }).join('\n    ');

  const escapedAuthor = author.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escapedKeyword = keyword.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <!-- Background -->
  <rect width="1200" height="630" fill="#1E3F2B"/>

  <!-- Decorative circle -->
  <circle cx="1050" cy="150" r="300" fill="#2D5E40" opacity="0.3"/>
  <circle cx="1100" cy="500" r="200" fill="#2D5E40" opacity="0.15"/>

  <!-- Tree silhouette (simplified) -->
  <g transform="translate(950, 100)" opacity="0.12">
    <ellipse cx="100" cy="80" rx="90" ry="75" fill="#8BAF8E"/>
    <ellipse cx="60" cy="110" rx="70" ry="60" fill="#8BAF8E"/>
    <ellipse cx="140" cy="110" rx="70" ry="60" fill="#8BAF8E"/>
    <rect x="90" y="160" width="20" height="120" rx="4" fill="#3A2A1F"/>
  </g>

  <!-- Category badge -->
  <rect x="80" y="80" width="${cat.label.length * 16 + 32}" height="36" rx="18" fill="${cat.bg}"/>
  <text x="${80 + (cat.label.length * 16 + 32) / 2}" y="104" fill="#FFF8F0" font-family="system-ui, sans-serif" font-size="14" font-weight="700" text-anchor="middle" letter-spacing="2">${cat.label}</text>

  <!-- Title -->
  ${titleSvg}

  <!-- Keyword tag -->
  ${keyword ? `<text x="80" y="${titleY + titleLines.length * 52 + 20}" fill="#D4A96A" font-family="system-ui, sans-serif" font-size="18" font-weight="500" opacity="0.8">${escapedKeyword}</text>` : ''}

  <!-- Divider -->
  <rect x="80" y="480" width="120" height="3" rx="1.5" fill="#C2734C"/>

  <!-- Brand -->
  <text x="80" y="530" fill="#FFF8F0" font-family="Georgia, 'Times New Roman', serif" font-size="24" font-weight="600">Big Sister Foundation</text>
  <text x="80" y="560" fill="#D4A96A" font-family="system-ui, sans-serif" font-size="13" font-weight="600" letter-spacing="2">ROOTED. PRESENT. PROTECTIVE.</text>

  <!-- Author -->
  <text x="80" y="595" fill="#FFF8F0" font-family="system-ui, sans-serif" font-size="15" opacity="0.5">By ${escapedAuthor}</text>
</svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  res.status(200).send(svg);
}
