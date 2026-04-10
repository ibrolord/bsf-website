import { readAiPosts } from './_lib/ai-posts.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  const posts = await readAiPosts();
  return res.status(200).json(posts);
}
