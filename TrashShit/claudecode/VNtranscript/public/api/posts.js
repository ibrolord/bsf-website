import { readFileSync } from 'fs';
import { join } from 'path';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  try {
    // Try reading the static JSON file deployed with the site
    const filePath = join(process.cwd(), 'data', 'ai-posts.json');
    const data = readFileSync(filePath, 'utf-8');
    const posts = JSON.parse(data);
    return res.status(200).json(posts);
  } catch (e) {
    // Also try alternate path
    try {
      const filePath = join(process.cwd(), 'public', 'data', 'ai-posts.json');
      const data = readFileSync(filePath, 'utf-8');
      return res.status(200).json(JSON.parse(data));
    } catch (e2) {
      return res.status(200).json([]);
    }
  }
}
