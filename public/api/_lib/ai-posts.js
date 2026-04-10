import { readFileSync } from 'fs';
import { join } from 'path';

export const AI_POSTS_GITHUB_REPO = process.env.GITHUB_REPO || 'ibrolord/bsf-website';
export const AI_POSTS_FILE_PATH = process.env.GITHUB_POSTS_FILE_PATH || 'public/data/ai-posts.json';
export const AI_POSTS_BRANCH = process.env.GITHUB_BRANCH || 'main';

function normalizePosts(value) {
  return Array.isArray(value) ? value : [];
}

function decodeGitHubContent(content) {
  return JSON.parse(Buffer.from(content, 'base64').toString('utf-8'));
}

export async function readAiPostsFromGitHub() {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'bsf-website-ai-posts'
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${AI_POSTS_GITHUB_REPO}/contents/${AI_POSTS_FILE_PATH}?ref=${AI_POSTS_BRANCH}`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`GitHub posts read failed (${response.status})`);
  }

  const payload = await response.json();
  if (!payload || typeof payload.content !== 'string') {
    throw new Error('GitHub posts payload missing content');
  }

  return normalizePosts(decodeGitHubContent(payload.content));
}

export function readBundledAiPosts() {
  const candidates = [
    join(process.cwd(), 'data', 'ai-posts.json'),
    join(process.cwd(), 'public', 'data', 'ai-posts.json')
  ];

  for (const filePath of candidates) {
    try {
      return normalizePosts(JSON.parse(readFileSync(filePath, 'utf-8')));
    } catch (_error) {}
  }

  return [];
}

export async function readAiPosts({ preferGitHub = true } = {}) {
  if (preferGitHub) {
    try {
      return await readAiPostsFromGitHub();
    } catch (_error) {}
  }

  return readBundledAiPosts();
}

export function sortPostsByDateDesc(posts) {
  return normalizePosts(posts).slice().sort(function(a, b) {
    return new Date(b.date || 0) - new Date(a.date || 0);
  });
}
