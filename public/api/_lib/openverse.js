const OPENVERSE_ENDPOINT = 'https://api.openverse.org/v1/images/';
const ALLOWED_LICENSES = 'cc0,by,by-sa,pdm';
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how', 'in',
  'into', 'is', 'it', 'its', 'of', 'on', 'or', 'our', 'the', 'their', 'through',
  'to', 'with', 'your'
]);
const BANNED_TITLE_PATTERN = /\b(logo|flag|seal|emblem|map|diagram|chart|poster|banner|brochure|icon|illustration|drawing|vector|screenshot)\b/i;
const CATEGORY_QUERIES = {
  guide: ['children education Nigeria', 'African children education', 'volunteer children Nigeria'],
  insight: ['Nigeria community children', 'African children community', 'children welfare Nigeria'],
  story: ['African children portrait', 'Nigeria children community', 'children education Africa'],
  update: ['volunteer children Nigeria', 'community outreach children Africa', 'children community Nigeria']
};
const VISUAL_THEMES = [
  {
    id: 'girls-education',
    query: 'girls education Africa',
    terms: ['girl', 'girls', 'female', 'women', 'sisterhood', 'mentor girls']
  },
  {
    id: 'education',
    query: 'African children classroom education',
    terms: ['education', 'school', 'scholarship', 'classroom', 'students', 'learning', 'tutoring', 'after school', 'literacy', 'homework']
  },
  {
    id: 'volunteer',
    query: 'children volunteer community Africa',
    terms: ['volunteer', 'mentor', 'mentoring', 'weekend', 'community service', 'tutor', 'support']
  },
  {
    id: 'protection',
    query: 'African children community support',
    terms: ['protection', 'welfare', 'safety', 'rights', 'support', 'care']
  },
  {
    id: 'community',
    query: 'African community children',
    terms: ['community', 'outreach', 'lagos', 'makoko', 'surulere', 'ajegunle', 'ikeja']
  }
];

function sanitizeToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  return sanitizeToken(value)
    .split(' ')
    .filter(function(token) {
      return token && token.length > 2 && !STOPWORDS.has(token);
    });
}

function uniqueQueries(queries) {
  const seen = new Set();
  return queries.filter(function(query) {
    const normalized = sanitizeToken(query);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function appendRegion(tokens, region) {
  const normalizedRegion = String(region || '').toLowerCase();
  return tokens.includes(normalizedRegion) ? tokens.join(' ') : tokens.concat(region).join(' ');
}

function extractHeadings(body) {
  return String(body || '')
    .split('\n')
    .filter(function(line) {
      return /^#{2,3}\s+/.test(line);
    })
    .map(function(line) {
      return line.replace(/^#{2,3}\s+/, '').trim();
    })
    .slice(0, 4);
}

function topTokensFromText(value, limit) {
  const counts = new Map();
  tokenize(value).forEach(function(token) {
    counts.set(token, (counts.get(token) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort(function(left, right) {
      return right[1] - left[1];
    })
    .slice(0, limit || 5)
    .map(function(entry) {
      return entry[0];
    });
}

function titleQuery(title) {
  const tokens = tokenize(title).slice(0, 5);
  return tokens.length ? appendRegion(tokens, 'Nigeria') : '';
}

function keywordQuery(keyword) {
  const tokens = tokenize(keyword).slice(0, 4);
  return tokens.length ? appendRegion(tokens, 'Nigeria') : '';
}

function keywordListQuery(keywords) {
  const tokens = String(keywords || '')
    .split(',')
    .flatMap(function(keyword) { return tokenize(keyword); })
    .slice(0, 4);
  return tokens.length ? appendRegion(tokens, 'Africa') : '';
}

function contextQuery(options) {
  const headings = extractHeadings(options.body).join(' ');
  const excerpt = String(options.excerpt || '');
  const tokens = topTokensFromText([excerpt, headings].join(' '), 5);
  return tokens.length ? appendRegion(tokens, 'Africa') : '';
}

function themeQueries(options) {
  const text = [
    options.title,
    options.excerpt,
    extractHeadings(options.body).join(' '),
    String(options.body || '').slice(0, 800),
    options.keyword,
    options.keywords
  ].join(' ').toLowerCase();

  return VISUAL_THEMES
    .map(function(theme) {
      const matches = theme.terms.reduce(function(total, term) {
        return total + (text.indexOf(term) !== -1 ? 1 : 0);
      }, 0);
      return { query: theme.query, matches: matches };
    })
    .filter(function(theme) {
      return theme.matches > 0;
    })
    .sort(function(left, right) {
      return right.matches - left.matches;
    })
    .slice(0, 3)
    .map(function(theme) {
      return theme.query;
    });
}

function buildSearchQueries(options) {
  const category = String(options.category || '').toLowerCase();
  const categoryQueries = CATEGORY_QUERIES[category] || CATEGORY_QUERIES.insight;

  return uniqueQueries([
    keywordQuery(options.keyword),
    keywordQuery(options.keyword).replace(/Nigeria$/, 'Africa'),
    titleQuery(options.title),
    keywordListQuery(options.keywords),
    contextQuery(options),
    (function() {
      const tokens = topTokensFromText(String(options.title || '') + ' ' + String(options.excerpt || ''), 4);
      return tokens.length ? appendRegion(tokens, 'Africa') : '';
    })(),
    ...themeQueries(options),
    categoryQueries[0],
    categoryQueries[1],
    categoryQueries[2]
  ]);
}

function normalizeThumbnailUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch (error) {
    return String(url || '').split('?')[0];
  }
}

function scoreImage(result, query) {
  const title = String(result.title || '');
  const lowerTitle = title.toLowerCase();
  const width = Number(result.width || 0);
  const height = Number(result.height || 0);
  const ratio = height ? width / height : 0;
  const queryTokens = tokenize(query);

  if (!result.thumbnail || width < 400 || height < 250) return -Infinity;
  if (BANNED_TITLE_PATTERN.test(title)) return -Infinity;

  let score = 0;
  if (/^[a-z]{0,4}[_-]?\d{3,}$/i.test(title) || /^dsc[_-]?\d+/i.test(title)) score -= 8;
  if (ratio >= 1.15 && ratio <= 1.9) score += 6;
  if (width >= 900) score += 4;
  if (height >= 600) score += 2;

  queryTokens.forEach(function(token) {
    if (lowerTitle.indexOf(token) !== -1) score += 3;
  });

  if (result.license === 'cc0' || result.license === 'pdm') score += 4;
  if (result.license === 'by' || result.license === 'by-sa') score += 2;

  return score;
}

async function searchOpenverse(query) {
  const params = new URLSearchParams({
    q: query,
    page_size: '12',
    license: ALLOWED_LICENSES
  });
  const response = await fetch(OPENVERSE_ENDPOINT + '?' + params.toString(), {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error('Openverse search failed: ' + response.status);
  }

  const payload = await response.json();
  return Array.isArray(payload.results) ? payload.results : [];
}

async function hasUsableThumbnail(url) {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow'
    });
    const contentType = String(response.headers.get('content-type') || '');
    return response.ok && contentType.indexOf('image/') === 0;
  } catch (error) {
    return false;
  }
}

export async function findRealtimeCoverImage(options) {
  const queries = buildSearchQueries(options);
  const candidates = [];
  const seenThumbnails = new Set();
  const usedThumbnails = new Set((options.usedThumbnails || []).map(normalizeThumbnailUrl).filter(Boolean));

  for (const query of queries) {
    let results = [];
    try {
      results = await searchOpenverse(query);
    } catch (error) {
      continue;
    }

    results.forEach(function(result) {
      const score = scoreImage(result, query);
      if (!Number.isFinite(score)) return;
      const normalizedThumbnail = normalizeThumbnailUrl(result.thumbnail);
      if (seenThumbnails.has(normalizedThumbnail)) return;
      if (usedThumbnails.has(normalizedThumbnail)) return;
      seenThumbnails.add(normalizedThumbnail);
      candidates.push({
        score,
        query,
        thumbnail: result.thumbnail,
        normalizedThumbnail,
        title: result.title || '',
        creator: result.creator || '',
        license: result.license || '',
        licenseVersion: result.license_version || '',
        source: result.source || '',
        sourceUrl: result.foreign_landing_url || ''
      });
    });
  }

  candidates.sort(function(left, right) {
    return right.score - left.score;
  });

  for (const candidate of candidates.slice(0, 10)) {
    if (await hasUsableThumbnail(candidate.thumbnail)) return candidate;
  }

  return null;
}

export function buildRealtimeCoverImageUrl(options) {
  const params = new URLSearchParams({
    title: options && options.title || '',
    category: options && options.category || '',
    keyword: options && options.keyword || '',
    keywords: options && options.keywords || ''
  });
  if (options && options.preferred) params.set('preferred', options.preferred);
  return '/api/post-cover?' + params.toString();
}
