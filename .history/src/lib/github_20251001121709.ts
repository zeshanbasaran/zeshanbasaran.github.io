/**
 * src/lib/github.ts
 * ------------------------------------------------------------
 * GitHub API Client Utilities (TypeScript)
 *
 * Purpose
 *   Shared helper functions to interact with the GitHub REST API.
 *   Used by components like ActivityFeed to fetch data in a clean,
 *   reusable way. Handles authentication, caching, error handling,
 *   and response normalization.
 *
 * Features
 *   - `fetchGithubEvents`: pull recent public events for a user
 *   - `fetchGithubRepos`: list repos for a user/org
 *   - `fetchGithubProfile`: get user profile metadata
 *   - Optional token support for higher API rate limits
 *   - In‑memory + sessionStorage caching with TTL
 *
 * Usage
 *   import { fetchGithubEvents, fetchGithubProfile } from "@/lib/github";
 *
 * Notes
 *   - API ref: https://docs.github.com/en/rest
 *   - For sensitive operations, provide a GitHub token with minimal scope.
 *   - This is a lightweight wrapper; prefer server‑side calls for sensitive
 *     or private data.
 * ------------------------------------------------------------
 */

export interface GithubEvent {
  id: string;
  type: string;
  repo?: { name: string };
  created_at: string;
  payload?: Record<string, any>;
}

export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description?: string;
  stargazers_count?: number;
  forks_count?: number;
  language?: string;
}

export interface GithubProfile {
  login: string;
  id: number;
  html_url: string;
  avatar_url: string;
  name?: string;
  company?: string;
  blog?: string;
  location?: string;
  bio?: string;
  public_repos: number;
  followers: number;
  following: number;
}

// ----------------------------
// Internal helpers
// ----------------------------
const API_BASE = "https://api.github.com";

function makeHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = { Accept: "application/vnd.github+json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function fetchJson<T>(url: string, token?: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { headers: makeHeaders(token), signal });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const e = new Error(`GitHub ${res.status}: ${text?.slice(0, 120)}`);
    (e as any).status = res.status;
    throw e;
  }
  return res.json() as Promise<T>;
}

function cacheKey(key: string): string {
  return `gh:cache:${key}`;
}

function readCache<T>(key: string, ttlMs: number): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (Date.now() - obj.ts > ttlMs) return null;
    return obj.data as T;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

// ----------------------------
// API Functions
// ----------------------------

/**
 * Fetch recent public events for a GitHub user.
 */
export async function fetchGithubEvents(
  username: string,
  { token, cacheTtlMs = 5 * 60 * 1000, signal }: { token?: string; cacheTtlMs?: number; signal?: AbortSignal } = {}
): Promise<GithubEvent[]> {
  const key = cacheKey(`events:${username}`);
  const cached = readCache<GithubEvent[]>(key, cacheTtlMs);
  if (cached) return cached;

  const url = `${API_BASE}/users/${encodeURIComponent(username)}/events/public`;
  const data = await fetchJson<GithubEvent[]>(url, token, signal);
  writeCache(key, data);
  return data;
}

/**
 * Fetch repositories for a user.
 */
export async function fetchGithubRepos(
  username: string,
  { token, cacheTtlMs = 5 * 60 * 1000, signal }: { token?: string; cacheTtlMs?: number; signal?: AbortSignal } = {}
): Promise<GithubRepo[]> {
  const key = cacheKey(`repos:${username}`);
  const cached = readCache<GithubRepo[]>(key, cacheTtlMs);
  if (cached) return cached;

  const url = `${API_BASE}/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=100`;
  const data = await fetchJson<GithubRepo[]>(url, token, signal);
  writeCache(key, data);
  return data;
}

/**
 * Fetch profile metadata for a user.
 */
export async function fetchGithubProfile(
  username: string,
  { token, cacheTtlMs = 60 * 60 * 1000, signal }: { token?: string; cacheTtlMs?: number; signal?: AbortSignal } = {}
): Promise<GithubProfile> {
  const key = cacheKey(`profile:${username}`);
  const cached = readCache<GithubProfile>(key, cacheTtlMs);
  if (cached) return cached;

  const url = `${API_BASE}/users/${encodeURIComponent(username)}`;
  const data = await fetchJson<GithubProfile>(url, token, signal);
  writeCache(key, data);
  return data;
}