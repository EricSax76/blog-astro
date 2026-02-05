
import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'url';

// Helper to get absolute path to data file
// In production/build, this needs careful handling, but for local dev/node adapter:
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve('./src/data/posts.json');

export const POST: APIRoute = async ({ request }) => {
  try {
    const newPost = await request.json();

    // Basic validation
    if (!newPost.title && !newPost.content && !newPost.image) {
      return new Response(JSON.stringify({ error: "Missing data" }), { status: 400 });
    }

    // Read existing posts
    let posts = [];
    try {
      const fileContent = await fs.readFile(DATA_FILE, 'utf-8');
      posts = JSON.parse(fileContent);
    } catch (error) {
      // If file doesn't exist or is empty, start with empty array
      posts = [];
    }

    // Add new post
    posts.unshift(newPost);

    // Write back to file
    await fs.writeFile(DATA_FILE, JSON.stringify(posts, null, 2), 'utf-8');

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
};
