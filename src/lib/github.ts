/**
 * src/lib/github.ts
 * ------------------------------------------------------------
 * GitHub API helper library (TypeScript)
 *
 * Purpose
 *   Provides a small set of utility functions to interact with the GitHub API,
 *   handle rate limiting, and normalize responses for use in components like
 *   ActivityFeed.
 *
 * Features
 *   - Fetch recent public events for a user
 *   - Fetch repository metadata (stars, forks, language, description)
 *   - Optional token authentication for higher rate limits
 *   - Simple in‑memory cache with optional TTL
 *   - TypeScript interfaces for strong typing
 *
 * Usage
 *   import { getUserEvents, getRepo } from "@/lib/github";
 *   const events = await getUserEvents("zeshanbasaran");
 *
 * Notes
 *   - Designed for client‑side and server‑side use (Astro, React, Node).
 *   - Be mindful of GitHub’s rate limits when using without a token.
 *   - Token should have minimal scopes (public data is fine with no scopes).
 * ------------------------------------------------------------
 */

// ----------------------------
// Types
// ----------------------------
export interface GitHubEvent {
  id: string;
  type: string;
  repo?: { name: string };
  actor?: { login: string; avatar_url?: string; url?: string };
  payload?: Record<string, any>;
  created_at: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language?: string;
}

// ----------------------------
// Config & helpers
// ----------------------------

const BASE_URL = "https://api.github.com";

function authHeaders(token?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// Simple in‑memory cache (per session)
const memoryCache: Record<string, { ts: number; data: any }> = {};

function getCached<T>(key: string, ttlMs: number): T | null {
  const c = memoryCache[key];
  if (!c) return null;
  if (Date.now() - c.ts > ttlMs) return null;
  return c.data as T;
}

function setCached<T>(key: string, data: T) {
  memoryCache[key] = { ts: Date.now(), data };
}

// ----------------------------
// API functions
// ----------------------------

/**
 * Fetch recent public events for a given user.
 * @param username GitHub username
 * @param opts Optional { token, limit, cacheTtlMs }
 */
export async function getUserEvents(
  username: string,
  opts: { token?: string; limit?: number; cacheTtlMs?: number } = {}
): Promise<GitHubEvent[]> {
  const { token, limit = 20, cacheTtlMs = 5 * 60 * 1000 } = opts;
  const key = `gh:events:${username}`;
  const cached = getCached<GitHubEvent[]>(key, cacheTtlMs);
  if (cached) return cached.slice(0, limit);

  const url = `${BASE_URL}/users/${encodeURIComponent(username)}/events/public`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${res.statusText}`);

  const json = (await res.json()) as GitHubEvent[];
  setCached(key, json);
  return json.slice(0, limit);
}

/**
 * Fetch repository metadata.
 * @param fullName Repo full name (e.g., "owner/repo")
 * @param opts Optional { token, cacheTtlMs }
 */
export async function getRepo(
  fullName: string,
  opts: { token?: string; cacheTtlMs?: number } = {}
): Promise<GitHubRepo> {
  const { token, cacheTtlMs = 10 * 60 * 1000 } = opts;
  const key = `gh:repo:${fullName}`;
  const cached = getCached<GitHubRepo>(key, cacheTtlMs);
  if (cached) return cached;

  const url = `${BASE_URL}/repos/${fullName}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${res.statusText}`);

  const json = (await res.json()) as GitHubRepo;
  setCached(key, json);
  return json;
}

/**
 * Generic fetch wrapper for any GitHub API endpoint.
 * @param endpoint Path after base URL (e.g., "/users/foo")
 * @param opts Optional { token, cacheKey, cacheTtlMs }
 */
export async function fetchGitHub<T = any>(
  endpoint: string,
  opts: { token?: string; cacheKey?: string; cacheTtlMs?: number } = {}
): Promise<T> {
  const { token, cacheKey, cacheTtlMs } = opts;
  if (cacheKey && cacheTtlMs) {
    const cached = getCached<T>(cacheKey, cacheTtlMs);
    if (cached) return cached;
  }

  const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${res.statusText}`);

  const json = (await res.json()) as T;
  if (cacheKey && cacheTtlMs) setCached(cacheKey, json);
  return json;
}
