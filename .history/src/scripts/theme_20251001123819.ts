/**
 * src/scripts/theme.ts
 * ------------------------------------------------------------
 * Client-side Theme Controller (TypeScript)
 *
 * Purpose
 *   Centralized, dependency-free theme utilities for an Astro + Tailwind app
 *   with a sci‑fi aesthetic. Supports light/dark/system modes, accent color
 *   variables, persistence, and live updates when the OS theme changes.
 *
 * Features
 *   - Modes: "light" | "dark" | "system" (default)
 *   - Persists user choice to localStorage
 *   - Responds to `prefers-color-scheme` changes when mode = system
 *   - Applies `class="dark"` (Tailwind's dark mode class strategy)
 *   - Sets `data-theme` on <html> for fine-grained theming
 *   - Updates <meta name="color-scheme"> for correct form/UA rendering
 *   - Accent color API via CSS custom properties (HSL or HEX)
 *   - Tiny event emitter: subscribe to theme changes
 *   - Safe to import from Astro/React components (no SSR side effects)
 *
 * Usage
 *   import { initializeTheme, toggleTheme } from "@/scripts/theme";
 *   initializeTheme(); // call once on hydration
 *   // ... later
 *   toggleTheme();
 *
 * Tailwind
 *   Ensure dark mode is enabled in Tailwind (default is class strategy):
 *     // tailwind.config
//  *     module.exports = { darkMode: "class", /* ... */ }
//  * ------------------------------------------------------------
//  */

// ----------------------------
// Types
// ----------------------------
export type ThemeMode = "light" | "dark" | "system";

export interface ThemeState {
  /** The user-selected mode (or "system"). */
  mode: ThemeMode;
  /** The effective mode after resolving system preference. */
  resolved: Exclude<ThemeMode, "system">;
  /** Current accent color (CSS var `--accent`). */
  accent?: string; // hsl(var(--accent)) friendly or hex
}

export interface ThemeInitOptions {
  /** Default mode on first visit (no prior storage). */
  defaultMode?: ThemeMode; // default: "system"
  /** Optional accent (e.g., "174 100% 50%" or "#22d3ee"). */
  defaultAccent?: string;
  /** Whether to apply immediately on import (defaults true in browser). */
  applyNow?: boolean;
}

// ----------------------------
// Constants & Keys
// ----------------------------
const STORAGE_KEY_MODE = "ui:theme:mode"; // "light" | "dark" | "system"
const STORAGE_KEY_ACCENT = "ui:theme:accent"; // string
const META_COLOR_SCHEME = 'meta[name="color-scheme"]';

// ----------------------------
// Lightweight event hub
// ----------------------------

type Handler = (state: ThemeState) => void;
const listeners = new Set<Handler>();

function emit(state: ThemeState) {
  listeners.forEach((fn) => {
    try { fn(state); } catch { /* noop */ }
  });
}

export function onThemeChange(handler: Handler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

// ----------------------------
// System preference helpers
// ----------------------------

function getMedia(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia("(prefers-color-scheme: dark)");
}

function resolveSystem(): "light" | "dark" {
  const m = getMedia();
  return m && m.matches ? "dark" : "light";
}

// ----------------------------
// Storage helpers (guarded for SSR)
// ----------------------------
function readStorage(key: string): string | null {
  try { return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null; } catch { return null; }
}
function writeStorage(key: string, val: string) {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(key, val); } catch { /* noop */ }
}

// ----------------------------
// DOM application
// ----------------------------

function setMetaColorScheme(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  let meta = document.querySelector<HTMLMetaElement>(META_COLOR_SCHEME);
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "color-scheme";
    document.head.appendChild(meta);
  }
  // Allow UA to render built-ins appropriately
  meta.content = resolved === "dark" ? "dark light" : "light dark";
}

function applyClassAndData(resolved: "light" | "dark", mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.setAttribute("data-theme", mode);
}

function applyAccent(accent?: string) {
  if (typeof document === "undefined" || !accent) return;
  const root = document.documentElement;
  // Accept HEX or HSL strings. If HEX, store as --accent-hex and compute a fallback hsl if desired.
  if (accent.startsWith("#")) {
    root.style.setProperty("--accent-hex", accent);
    root.style.setProperty("--accent", accent); // consumers may use color: var(--accent)
  } else {
    // Expecting "H S% L%" or full hsl string; keep generic
    root.style.setProperty("--accent", accent);
  }
}

// ----------------------------
// State & API
// ----------------------------

let current: ThemeState | null = null;
let initialized = false;
let unsubscribeMedia: (() => void) | null = null;

function computeState(mode: ThemeMode, accent?: string): ThemeState {
  const resolved = mode === "system" ? resolveSystem() : mode;
  return { mode, resolved, accent };
}

function applyState(state: ThemeState) {
  applyClassAndData(state.resolved, state.mode);
  setMetaColorScheme(state.resolved);
  applyAccent(state.accent);
  current = state;
  emit(state);
}

export function getThemeState(): ThemeState {
  if (current) return current;
  const storedMode = (readStorage(STORAGE_KEY_MODE) as ThemeMode | null) ?? "system";
  const storedAccent = readStorage(STORAGE_KEY_ACCENT) ?? undefined;
  current = computeState(storedMode, storedAccent);
  return current;
}

export function setTheme(mode: ThemeMode) {
  const s0 = getThemeState();
  const s1 = computeState(mode, s0.accent);
  writeStorage(STORAGE_KEY_MODE, mode);
  applyState(s1);
}

export function toggleTheme(cycle: Array<ThemeMode> = ["light", "dark", "system"]) {
  const s = getThemeState();
  const idx = Math.max(0, cycle.indexOf(s.mode));
  const next = cycle[(idx + 1) % cycle.length] ?? "system";
  setTheme(next);
}

export function setAccent(accent: string) {
  const s = getThemeState();
  writeStorage(STORAGE_KEY_ACCENT, accent);
  applyState({ ...s, accent });
}

/**
 * Initialize theme system: reads storage, applies theme, and subscribes
 * to OS preference changes if mode = system.
 */
export function initializeTheme(options: ThemeInitOptions = {}) {
  if (initialized) return getThemeState();
  initialized = true;

  const defaultMode = options.defaultMode ?? "system";
  const storedMode = (readStorage(STORAGE_KEY_MODE) as ThemeMode | null) ?? defaultMode;
  const storedAccent = readStorage(STORAGE_KEY_ACCENT) ?? options.defaultAccent;
  const state = computeState(storedMode, storedAccent ?? undefined);

  if (options.applyNow !== false && typeof window !== "undefined") {
    applyState(state);
  } else {
    current = state;
  }

  // Subscribe to OS changes when in system mode
  const media = getMedia();
  const handle = () => {
    const s = getThemeState();
    if (s.mode === "system") applyState(computeState("system", s.accent));
  };
  if (media && typeof media.addEventListener === "function") {
    media.addEventListener("change", handle);
    unsubscribeMedia = () => media.removeEventListener("change", handle);
  } else if (media && typeof (media as any).addListener === "function") {
    // Safari < 14 fallback
    (media as any).addListener(handle);
    unsubscribeMedia = () => (media as any).removeListener(handle);
  }

  // Optional: keyboard shortcut (Alt+T) to toggle light/dark
  if (typeof window !== "undefined") {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "t" || e.key === "T")) {
        e.preventDefault();
        toggleTheme(["light", "dark"]);
      }
    };
    window.addEventListener("keydown", onKey);
    // Cleanup hook if a bundler does HMR
    if (import.meta && (import.meta as any).hot) {
      (import.meta as any).hot.dispose(() => window.removeEventListener("keydown", onKey));
    }
  }

  return getThemeState();
}

/**
 * Attach a click handler to any button to toggle theme.
 * Example: bindThemeToggle(document.querySelector('#theme-btn'))
 */
export function bindThemeToggle(el: Element | null, cycle?: Array<ThemeMode>) {
  if (!el) return () => {};
  const onClick = (e: Event) => { e.preventDefault(); toggleTheme(cycle); };
  el.addEventListener("click", onClick);
  return () => el.removeEventListener("click", onClick);
}

/**
 * Cleanup (unsubscribe media listeners). Rarely needed manually.
 */
export function disposeTheme() {
  if (unsubscribeMedia) { unsubscribeMedia(); unsubscribeMedia = null; }
  initialized = false;
}

// ------------------------------------------------------------
// Auto-apply when imported in the browser (safe no-op on SSR)
// ------------------------------------------------------------
if (typeof window !== "undefined") {
  // Apply early to avoid FOUC; no-op if initializeTheme is called later.
  initializeTheme({ applyNow: true });
}
