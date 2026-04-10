import { readFileSync } from 'fs';
import { join } from 'path';

const GITHUB_REPO = process.env.GITHUB_REPO || 'ibrolord/bsf-website';
const POSTS_FILE_PATH = process.env.GITHUB_POSTS_FILE_PATH || 'public/data/ai-posts.json';
const BRANCH = process.env.GITHUB_BRANCH || 'main';

async function readGitHubPosts() {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'bsf-website-posts-api'
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${POSTS_FILE_PATH}?ref=${BRANCH}`,
    { headers }
  );
  if (!response.ok) {
    throw new Error(`GitHub posts read failed (${response.status})`);
  }

  const payload = await response.json();
  if (!payload || typeof payload.content !== 'string') {
    throw new Error('GitHub posts payload missing content');
  }

  const posts = JSON.parse(Buffer.from(payload.content, 'base64').toString('utf-8'));
  if (!Array.isArray(posts)) {
    throw new Error('GitHub posts payload is not an array');
  }
  return posts;
}

function readBundledPosts() {
  const paths = [
    join(process.cwd(), 'data', 'ai-posts.json'),
    join(process.cwd(), 'public', 'data', 'ai-posts.json')
  ];

  for (const filePath of paths) {
    try {
      const posts = JSON.parse(readFileSync(filePath, 'utf-8'));
      if (Array.isArray(posts)) {
        return posts;
      }
    } catch (_error) {}
  }

  return [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  try {
    const posts = await readGitHubPosts();
    return res.status(200).json(posts);
  } catch (_error) {
    return res.status(200).json(readBundledPosts());
  }
}
