const fs = require('fs');
const path = require('path');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch (_err) {
    return require(require.resolve('playwright', {
      paths: ['/Users/ibrobaba/codex/ui-test-tmp']
    }));
  }
}

const { chromium } = loadPlaywright();

const BASE_URL = process.env.BASE_URL || 'https://public-mu-steel.vercel.app';
const RESULTS_DIR = '/Users/ibrobaba/codex/ui-test-tmp/results';

function reportStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_err) {
    body = { raw: text };
  }
  return { response, body };
}

async function waitForLiveApiTitle(page, title) {
  await page.waitForFunction(function(expectedTitle) {
    var featured = document.querySelector('#featuredPost');
    var grid = document.querySelector('#blogGrid');
    var text = '';
    if (featured) text += ' ' + (featured.innerText || '');
    if (grid) text += ' ' + (grid.innerText || '');
    return text.indexOf(expectedTitle) !== -1;
  }, title, { timeout: 20000 });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const result = {
    ok: false,
    baseUrl: BASE_URL,
    consoleErrors,
    pageErrors,
    api: {},
    steps: {}
  };
  let failure = null;

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  try {
    const postsApi = await jsonFetch(`${BASE_URL}/api/posts`);
    if (!postsApi.response.ok || !Array.isArray(postsApi.body) || !postsApi.body.length) {
      throw new Error(`Public posts API failed: ${postsApi.response.status} ${JSON.stringify(postsApi.body)}`);
    }
    result.api.postsStatus = postsApi.response.status;
    result.api.postsCount = postsApi.body.length;
    result.api.topTitle = String(postsApi.body[0].title || '').trim();
    if (!result.api.topTitle) {
      throw new Error('Public posts API returned a top post without a title');
    }

    await page.goto(`${BASE_URL}/blog/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#featuredPost h2', { state: 'visible', timeout: 15000 });
    await page.waitForSelector('#blogGrid .post-card', { state: 'visible', timeout: 15000 });
    await waitForLiveApiTitle(page, result.api.topTitle);

    result.steps.listing = {
      featuredTitle: (await page.locator('#featuredPost h2').innerText()).trim(),
      gridCount: await page.locator('#blogGrid .post-card').count(),
      topApiTitleVisible: true
    };

    const firstCard = page.locator('#blogGrid .post-card').first();
    const firstCardTitle = (await firstCard.locator('.post-card__title').innerText()).trim();
    const firstCardId = await firstCard.getAttribute('data-id');
    if (!firstCardTitle || !firstCardId) {
      throw new Error('First public blog card is missing title or data-id');
    }

    const searchQuery = firstCardTitle.split(/\s+/).slice(0, 3).join(' ');
    await page.fill('#searchInput', searchQuery);
    await page.waitForTimeout(500);
    const filteredCount = await page.locator('#blogGrid .post-card').count();
    const filteredFirstTitle = filteredCount
      ? (await page.locator('#blogGrid .post-card').first().locator('.post-card__title').innerText()).trim()
      : '';
    if (!filteredCount || filteredFirstTitle.toLowerCase().indexOf(searchQuery.toLowerCase()) === -1) {
      throw new Error(`Public blog search failed for "${searchQuery}"`);
    }
    result.steps.search = {
      query: searchQuery,
      filteredCount,
      firstTitle: filteredFirstTitle
    };

    await page.fill('#searchInput', '');
    await page.waitForTimeout(500);

    await firstCard.click();
    await page.waitForSelector('#postDetail:not(.hidden) #postDetailContent h1', { state: 'visible', timeout: 10000 });
    const detailTitle = (await page.locator('#postDetailContent h1').innerText()).trim();
    const detailUrl = page.url();
    const schemaHeadline = await page.locator('#article-schema').evaluate(function(node) {
      return JSON.parse(node.textContent || '{}').headline || '';
    });
    if (detailTitle !== firstCardTitle) {
      throw new Error(`Detail title mismatch: expected "${firstCardTitle}", got "${detailTitle}"`);
    }
    if (detailUrl.indexOf('?post=') === -1) {
      throw new Error(`Detail route missing ?post=: ${detailUrl}`);
    }
    result.steps.detail = {
      title: detailTitle,
      url: detailUrl,
      schemaHeadline
    };

    await page.click('#backToList');
    await page.waitForSelector('#blogListing:not(.hidden)', { state: 'visible', timeout: 10000 });
    result.steps.backToList = {
      url: page.url(),
      listingVisible: await page.locator('#blogListing').evaluate(function(node) {
        return !node.classList.contains('hidden');
      })
    };

    await page.goto(`${BASE_URL}/blog/?post=${encodeURIComponent(firstCardId)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#postDetail:not(.hidden) #postDetailContent h1', { state: 'visible', timeout: 10000 });
    const deepLinkTitle = (await page.locator('#postDetailContent h1').innerText()).trim();
    if (deepLinkTitle !== firstCardTitle) {
      throw new Error(`Deep-link title mismatch: expected "${firstCardTitle}", got "${deepLinkTitle}"`);
    }
    result.steps.deepLink = {
      url: page.url(),
      title: deepLinkTitle
    };

    if (consoleErrors.length || pageErrors.length) {
      throw new Error(`Public blog emitted errors: console=${consoleErrors.length} page=${pageErrors.length}`);
    }

    result.ok = true;
  } catch (err) {
    failure = err;
    result.ok = false;
    result.error = String(err && err.stack ? err.stack : err);
  } finally {
    await context.close().catch(function() {});
    await browser.close().catch(function() {});
  }

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const reportPath = path.join(RESULTS_DIR, `public-blog-smoke-verify-${reportStamp()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ reportPath, ok: result.ok }, null, 2));

  if (failure) {
    throw failure;
  }
})().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
