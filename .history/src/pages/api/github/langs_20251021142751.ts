// src/pages/api/github/langs.json.ts
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const owner = url.searchParams.get("owner");
  const repo  = url.searchParams.get("repo");

  if (!owner || !repo) {
    return new Response(JSON.stringify({ error: "missing owner/repo" }), { status: 400 });
  }

  const gh = `https://api.github.com/repos/${owner}/${repo}/languages`;
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "astro-portfolio-langs"
  };

  // Use a server-side token for higher rate limits (do NOT expose to client!)
  const token = import.meta.env.GITHUB_TOKEN;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(gh, { headers });
    const text = await res.text(); // keep raw to pass-through on errors

    return new Response(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "application/json",
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400" // cache on edge if available
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "network error" }), { status: 502 });
  }
};
