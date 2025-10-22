/**
 * src/scripts/facts.ts
 * ------------------------------------------------------------
 * Sci‑Fi "Fun Facts" & Status Blips (TypeScript)
 *
 * Purpose
 *   Centralized store and helper utilities for short "facts" / "blips"
 *   that you can surface across the portfolio (hero ticker, terminal overlay,
 *   about page sidebars, or holographic HUD elements). Facts can be technical,
 *   project‑specific, or playful sci‑fi one‑liners.
 *
 * Features
 *   - Typed Fact model with id, text, tags, weight, and source link
 *   - Deterministic daily rotation (same sequence for a given day)
 *   - Seeded pseudo‑random selection for consistent UI snapshots
 *   - Weighted sampling to prioritize certain facts
 *   - Clean helpers: getRandomFact, getDailyFacts, getFactsByTag
 *   - Zero dependencies; works in Node, Astro, and the browser
 *
 * Usage (example)
 *   import { getDailyFacts } from "@/scripts/facts";
 *   const blips = getDailyFacts(5); // 5 facts, deterministic for today
 *
 * Styling idea (Tailwind)
 *   <ul className="font-mono text-xs text-cyan-300/90">
 *     {blips.map(f => <li key={f.id}>› {f.text}</li>)}
 *   </ul>
 * ------------------------------------------------------------
 */

// ----------------------------------
// Types
// ----------------------------------
export type Tag =
  | "data"
  | "ml"
  | "software"
  | "sci-fi"
  | "portfolio"
  | "performance"
  | "astro"
  | "tailwind"
  | "plotly"
  | "streamlit"
  | "sql"
  | "fun";

export interface Fact {
  /** stable identifier (used for deterministic shuffles) */
  id: string;
  /** the message shown in UI */
  text: string;
  /** lightweight categorization */
  tags?: Tag[];
  /** 1 = default; >1 increases pick likelihood */
  weight?: number;
  /** optional attribution */
  source?: string;
  /** optional URL for 'learn more' links */
  url?: string;
}

// ----------------------------------
// Internal utils: hashing, rng, weighting
// ----------------------------------

/** FNV‑1a 32‑bit hash for short strings */
export function hash32(input: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) >>> 0;
}

/** Mulberry32 PRNG (deterministic) */
export function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic shuffle (Fisher‑Yates with seeded RNG) */
export function shuffleSeeded<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  const rnd = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Weighted sample without replacement using Efraimidis–Spirakis method */
export function weightedSample<T extends { weight?: number }>(
  arr: T[],
  k: number,
  rnd: () => number
): T[] {
  if (k <= 0 || arr.length === 0) return [];
  const scored = arr.map((item) => {
    const w = Math.max(1, item.weight ?? 1);
    // Draw key = U^(1/w); sort desc, take top k
    const key = Math.pow(rnd(), 1 / w);
    return { item, key };
  });
  scored.sort((a, b) => b.key - a.key);
  return scored.slice(0, Math.min(k, scored.length)).map((s) => s.item);
}

// ----------------------------------
// Canonical fact list
// ----------------------------------

const FACTS: Fact[] = [
  {
    id: "astro‑islands",
    text: "Astro ships zero JS by default to each page—hydrate components as islands only when needed.",
    tags: ["astro", "performance", "portfolio"],
    weight: 2,
    url: "https://docs.astro.build/en/concepts/islands/",
  },
  {
    id: "tailwind‑jit",
    text: "Tailwind’s JIT compiles only the classes you use, keeping CSS payloads tiny.",
    tags: ["tailwind", "performance"],
  },
  {
    id: "plotly‑webgl",
    text: "Plotly can switch to WebGL for large scatter traces—great for high‑density data.",
    tags: ["plotly", "data"],
  },
  {
    id: "streamlit‑components",
    text: "Streamlit supports custom components, so you can extend dashboards with React widgets.",
    tags: ["streamlit", "software"],
  },
  {
    id: "sql‑index‑tip",
    text: "Covering indexes speed up SELECTs when all needed columns are in the index itself.",
    tags: ["sql", "data"],
  },
  {
    id: "ml‑leakage",
    text: "Data leakage often hides in feature engineering. Always split before transforming.",
    tags: ["ml", "data"],
  },
  {
    id: "sci‑fi‑holo",
    text: "Holographic UI trick: high contrast neon borders + subtle blur + noise = futuristic vibe.",
    tags: ["sci-fi", "portfolio"],
  },
  {
    id: "bigO‑note",
    text: "An O(n log n) algorithm can win in practice if constants are small and cache‑friendly.",
    tags: ["software"],
  },
  {
    id: "git‑conventional",
    text: "Conventional commits (+ semantic versioning) make changelogs and releases effortless.",
    tags: ["software", "portfolio"],
  },
  {
    id: "risk‑drawdown",
    text: "Max drawdown shows worst peak‑to‑trough loss—vital for strategy risk profiles.",
    tags: ["data", "ml"],
  },
  {
    id: "http‑preconnect",
    text: "Use <link rel=\"preconnect\"> for third‑party origins (fonts, APIs) to cut handshake time.",
    tags: ["performance", "portfolio"],
  },
  {
    id: "a11y‑prefers‑reduced‑motion",
    text: "Respect prefers‑reduced‑motion: reduce parallax, long fades, and continuous animations.",
    tags: ["portfolio", "software"],
  },
  {
    id: "seed‑rng",
    text: "Seeded PRNGs yield reproducible dashboards—great for demos and snapshot tests.",
    tags: ["software", "plotly"],
  },
  {
    id: "sci‑fi‑clearance",
    text: "Clearance Level: Data Analyst/Computer Scientist — access to mission logs granted.",
    tags: ["sci-fi", "portfolio"],
  },
  {
    id: "dash‑islands",
    text: "Embed dashboards as ‘islands’ to keep static pages blazing fast.",
    tags: ["astro", "performance", "plotly"],
  },
];

// ----------------------------------
// Public API
// ----------------------------------

/**
 * Return all facts.
 */
export function listFacts(): Fact[] {
  return FACTS.slice();
}

/**
 * Filter facts by tag.
 */
export function getFactsByTag(tag: Tag): Fact[] {
  return FACTS.filter((f) => f.tags?.includes(tag));
}

/**
 * Get a single random fact. If `seed` is provided, selection is deterministic.
 */
export function getRandomFact(seed?: number): Fact | null {
  if (FACTS.length === 0) return null;
  if (seed == null) {
    const idx = Math.floor(Math.random() * FACTS.length);
    return FACTS[idx];
  }
  const rnd = mulberry32(seed);
  const idx = Math.floor(rnd() * FACTS.length);
  return FACTS[idx];
}

/**
 * Deterministic daily facts (stable order for a given date + optional salt).
 * Useful for “Today’s Logs” or rotating sidebar tidbits.
 */
export function getDailyFacts(
  count = 5,
  options: { date?: Date; salt?: string; weighted?: boolean } = {}
): Fact[] {
  const { date = new Date(), salt = "", weighted = true } = options;
  const dayKey = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}-${salt}`;
  const seed = hash32(dayKey);
  const rnd = mulberry32(seed);

  if (weighted) {
    return weightedSample(FACTS, count, rnd);
  }
  return shuffleSeeded(FACTS, seed).slice(0, Math.min(count, FACTS.length));
}

/**
 * Add one or more facts at runtime (e.g., from CMS). Id collisions are ignored.
 */
export function registerFacts(newFacts: Fact | Fact[]): number {
  const arr = Array.isArray(newFacts) ? newFacts : [newFacts];
  let added = 0;
  for (const f of arr) {
    if (!f?.id || FACTS.some((x) => x.id === f.id)) continue;
    (FACTS as Fact[]).push(f);
    added++;
  }
  return added;
}

// ----------------------------------
// Tiny CLI hook (optional)
//   node --loader ts-node/esm src/scripts/facts.ts 3
// ----------------------------------
if (typeof process !== "undefined" && process.argv && process.argv[1]?.includes("facts.ts")) {
  const n = Number(process.argv[2] ?? 5) || 5;
  const out = getDailyFacts(n).map((f) => `• ${f.text}`);
  // eslint-disable-next-line no-console
  console.log(out.join("\n"));
}
