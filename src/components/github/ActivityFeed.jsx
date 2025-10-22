/**
 * src/components/github/ActivityFeed.jsx
 * ------------------------------------------------------------
 * Sci‑Fi GitHub Activity Feed (React)
 *
 * Purpose
 *   A sleek, holographic activity feed card that pulls recent public events
 *   from the GitHub API for a given username. Built for Astro + React and
 *   styled with Tailwind to match a futuristic "secure system" aesthetic.
 *
 * Features
 *   - Fetches recent public events (pushes, PRs, issues, stars, forks, releases)
 *   - Clean, readable event normalization with icons per event type
 *   - Optional GitHub token support to raise rate limits (via props)
 *   - Simple in‑memory + sessionStorage caching to avoid repeated fetches
 *   - Graceful empty / error / rate‑limit states
 *   - Framer Motion entrance animations + subtle hover glow
 *   - Fully client‑side; safe to drop into an Astro page with client:visible
 *
 * Usage (Astro)
 *   ---
 *   import ActivityFeed from "@/components/github/ActivityFeed.jsx";
 *   ---
 *   <ActivityFeed client:visible username="zeshanbasaran" limit={8} />
 *
 * Props
 *   - username: string (GitHub handle). Default: "zeshanbasaran"
 *   - limit: number of items to display. Default: 10
 *   - token: string (optional GitHub PAT for higher rate limit)
 *   - cacheTtlMs: number (cache lifetime). Default: 5 * 60 * 1000 (5 minutes)
 *   - className: string (extra Tailwind classes)
 *
 * Notes
 *   - Public events endpoint: https://api.github.com/users/{username}/events/public
 *   - If you see frequent 403s, pass a low‑scope token via the `token` prop.
 *   - This component intentionally avoids server rendering since GitHub rate
 *     limits can break static builds; prefer client hydration.
 * ------------------------------------------------------------
 */

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitCommit,
  GitPullRequest,
  GitMerge,
  GitBranch,
  Star,
  GitFork,
  MessageSquareText,
  Bug,
  Rocket,
  FolderPlus,
  FilePlus2,
  FilePenLine,
  BookOpen,
  RefreshCw,
} from "lucide-react";

// ----------------------------
// Small utilities
// ----------------------------
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function timeAgo(iso) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(1, Math.floor((now - then) / 1000));
  const units = [
    [60, "s"],
    [60, "m"],
    [24, "h"],
    [7, "d"],
    [52, "w"],
  ];
  let v = s;
  let u = "s";
  for (let i = 0; i < units.length; i++) {
    const [step, label] = units[i];
    if (v < step) { u = label; break; }
    v = Math.floor(v / step);
    u = label;
  }
  return `${v}${u} ago`;
}

function joinRepo(fullName) {
  // fullName is like "owner/repo"; return repo part for compact UI
  if (!fullName) return "";
  const parts = String(fullName).split("/");
  return parts[1] || fullName;
}

function cacheKey(username) {
  return `gh:events:${username}`;
}

// Normalize GitHub event payloads to a uniform card model
function normalizeEvent(evt) {
  const type = evt?.type || "Event";
  const repoFull = evt?.repo?.name || "";
  const repo = joinRepo(repoFull);
  const urlRepo = `https://github.com/${repoFull}`;
  const created = evt?.created_at;

  const base = {
    id: `${evt?.id}`,
    type,
    created,
    timeAgo: created ? timeAgo(created) : "",
    repo,
    urlRepo,
    urlPrimary: urlRepo,
    title: type,
    icon: BookOpen,
    accent: "border-cyan-400/50 shadow-cyan-500/10",
  };

  try {
    switch (type) {
      case "PushEvent": {
        const commits = evt?.payload?.commits || [];
        const n = commits.length;
        return {
          ...base,
          title: `Pushed ${n} commit${n === 1 ? "" : "s"}`,
          icon: GitCommit,
          accent: "border-emerald-400/50 shadow-emerald-500/10",
          details: commits.slice(-3).map((c) => c.message).filter(Boolean),
        };
      }
      case "PullRequestEvent": {
        const pr = evt?.payload?.pull_request;
        const action = evt?.payload?.action;
        return {
          ...base,
          title: `${action === "opened" ? "Opened" : action === "closed" && pr?.merged ? "Merged" : action || "Updated"} PR #${pr?.number ?? ""}`,
          icon: pr?.merged ? GitMerge : GitPullRequest,
          accent: pr?.merged ? "border-fuchsia-400/50 shadow-fuchsia-500/10" : "border-blue-400/50 shadow-blue-500/10",
          urlPrimary: pr?.html_url || base.urlPrimary,
          details: pr?.title ? [pr.title] : [],
        };
      }
      case "IssuesEvent": {
        const issue = evt?.payload?.issue;
        const action = evt?.payload?.action;
        return {
          ...base,
          title: `${(action || "Updated").replace(/^./, (c) => c.toUpperCase())} issue #${issue?.number ?? ""}`,
          icon: Bug,
          accent: "border-amber-400/50 shadow-amber-500/10",
          urlPrimary: issue?.html_url || base.urlPrimary,
          details: issue?.title ? [issue.title] : [],
        };
      }
      case "IssueCommentEvent":
      case "PullRequestReviewCommentEvent": {
        const comment = evt?.payload?.comment;
        return {
          ...base,
          title: "Commented",
          icon: MessageSquareText,
          accent: "border-indigo-400/50 shadow-indigo-500/10",
          urlPrimary: comment?.html_url || base.urlPrimary,
          details: comment?.body ? [comment.body.slice(0, 160)] : [],
        };
      }
      case "WatchEvent": {
        return {
          ...base,
          title: "Starred repo",
          icon: Star,
          accent: "border-yellow-400/50 shadow-yellow-500/10",
        };
      }
      case "ForkEvent": {
        const forkee = evt?.payload?.forkee;
        return {
          ...base,
          title: "Forked repo",
          icon: GitFork,
          accent: "border-pink-400/50 shadow-pink-500/10",
          urlPrimary: forkee?.html_url || base.urlPrimary,
        };
      }
      case "CreateEvent": {
        const refType = evt?.payload?.ref_type;
        return {
          ...base,
          title: `Created ${refType}`,
          icon: refType === "branch" ? GitBranch : refType === "repository" ? FolderPlus : FilePlus2,
          accent: "border-sky-400/50 shadow-sky-500/10",
        };
      }
      case "ReleaseEvent": {
        const rel = evt?.payload?.release;
        return {
          ...base,
          title: `Published release ${rel?.tag_name || ""}`,
          icon: Rocket,
          accent: "border-teal-400/50 shadow-teal-500/10",
          urlPrimary: rel?.html_url || base.urlPrimary,
          details: rel?.name ? [rel.name] : [],
        };
      }
      default:
        return base;
    }
  } catch (_) {
    return base;
  }
}

async function fetchEvents({ username, token, signal }) {
  const headers = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = `https://api.github.com/users/${encodeURIComponent(username)}/events/public`;
  const res = await fetch(url, { headers, signal });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const e = new Error(`GitHub ${res.status}: ${text?.slice(0, 120)}`);
    e.status = res.status;
    throw e;
  }
  return res.json();
}

function useGithubEvents(username, { token, cacheTtlMs = 5 * 60 * 1000 } = {}) {
  const [state, setState] = useState({ loading: true, error: null, events: [] });

  useEffect(() => {
    let alive = true;
    const key = cacheKey(username);

    // Session cache first
    try {
      const cached = JSON.parse(sessionStorage.getItem(key) || "null");
      if (cached && Date.now() - cached.ts < cacheTtlMs) {
        setState({ loading: false, error: null, events: cached.events || [] });
        return () => { alive = false; };
      }
    } catch (_) {}

    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchEvents({ username, token, signal: ctrl.signal })
      .then((json) => {
        if (!alive) return;
        const events = Array.isArray(json) ? json.map(normalizeEvent) : [];
        setState({ loading: false, error: null, events });
        try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), events })); } catch (_) {}
      })
      .catch((err) => {
        if (!alive) return;
        setState({ loading: false, error: err, events: [] });
      });
    return () => { alive = false; ctrl.abort(); };
  }, [username, token, cacheTtlMs]);

  return state;
}

export default function ActivityFeed({
  username = "zeshanbasaran",
  limit = 10,
  token,
  cacheTtlMs,
  className = "",
}) {
  const { loading, error, events } = useGithubEvents(username, { token, cacheTtlMs });
  const items = useMemo(() => (events || []).slice(0, clamp(limit, 1, 30)), [events, limit]);

  return (
    <div className={`relative w-full ${className}`}>
      {/* Holo frame */}
      <div className="relative rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-slate-900/70 to-slate-900/30 backdrop-blur-xl shadow-[0_0_40px_-10px_rgba(34,211,238,0.25)]">
        <header className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-cyan-500/10">
          <div className="flex items-center gap-2 text-cyan-200/90">
            <RefreshCw className="h-4 w-4 animate-spin-slow opacity-70" aria-hidden />
            <span className="font-mono text-xs tracking-wider uppercase">Recent GitHub Activity</span>
          </div>
          <a
            href={`https://github.com/${encodeURIComponent(username)}`}
            target="_blank"
            rel="noreferrer noopener"
            className="text-xs text-cyan-300/80 hover:text-cyan-200 underline decoration-dotted underline-offset-4"
          >
            @{username}
          </a>
        </header>

        {/* Body */}
        <div className="p-3 sm:p-4">
          {loading && (
            <ul className="grid gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="animate-pulse rounded-xl border border-cyan-500/10 bg-slate-800/30 p-3">
                  <div className="h-4 w-32 bg-slate-600/40 rounded mb-2" />
                  <div className="h-3 w-64 bg-slate-600/30 rounded" />
                </li>
              ))}
            </ul>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200/90">
              {error.status === 403 ? (
                <p>Rate limit reached. Add a GitHub token or try again later.</p>
              ) : (
                <p>Failed to load activity. {String(error.message || error)}</p>
              )}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="rounded-xl border border-cyan-500/20 bg-slate-800/30 p-4 text-sm text-slate-300">
              No recent public events.
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <ul className="grid gap-2">
              <AnimatePresence initial={true}>
                {items.map((e, idx) => (
                  <motion.li
                    key={e.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.22, delay: idx * 0.03 }}
                    className={`group relative overflow-hidden rounded-xl border ${e.accent} bg-slate-900/40 p-3 shadow-lg hover:shadow-xl hover:shadow-cyan-500/10 transition-shadow`}
                  >
                    <EventRow evt={e} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function EventRow({ evt }) {
  const Icon = evt.icon || BookOpen;
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0 rounded-lg border border-cyan-500/30 bg-slate-800/60 p-2">
        <Icon className="h-4 w-4 text-cyan-300" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <a
            href={evt.urlPrimary}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-slate-100 hover:text-cyan-200 hover:underline"
          >
            {evt.title}
          </a>
          {evt.repo && (
            <span className="truncate text-slate-400">
              in <a href={evt.urlRepo} target="_blank" rel="noreferrer noopener" className="text-cyan-300/90 hover:text-cyan-200 hover:underline">{evt.repo}</a>
            </span>
          )}
          <span className="ml-auto text-xs font-mono text-slate-400">{evt.timeAgo}</span>
        </div>
        {evt.details && evt.details.length > 0 && (
          <ul className="mt-1 space-y-1">
            {evt.details.map((d, i) => (
              <li key={i} className="text-xs text-slate-300/90 line-clamp-2">
                • {d}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Tailwind helper: slow spin used in header indicator
// Add this to your global CSS if you don’t already have it:
// .animate-spin-slow { animation: spin 6s linear infinite; }
