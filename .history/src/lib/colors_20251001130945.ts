/* -----------------------------------------------------------
 * File: src/lib/colors.ts
 * Project: Sci-Fi Portfolio Website
 * Author: Zeshan Basaran
 *
 * Purpose:
 *   Centralized color definitions and helpers for the website.
 *   Exports a consistent theme palette to be reused in:
 *     - HUD components
 *     - Resume panels
 *     - Project cards
 *     - Neon frames & particle effects
 *
 * Usage:
 *   import { COLORS, withAlpha, glowShadow } from "@/lib/colors";
 *
 * Notes:
 *   - Designed for Tailwind + CSS-in-JS hybrid usage.
 *   - TypeScript ensures type-safety for palette keys.
 * ----------------------------------------------------------- */

/**
 * Core sci-fi themed palette.
 * Neon cyan + magenta with supporting neutrals.
 */
export const COLORS = {
  background: "#0a0f1c",
  surface: "#121829",
  surfaceAlt: "#1a2238",
  text: "#e0e6ed",

  accent: "#00f7ff",       // Neon cyan
  accentAlt: "#ff007f",    // Neon magenta
  accentSoft: "#4dd2ff",   // Soft cyan for hover/focus

  success: "#22eaa6",
  warning: "#ffd166",
  error: "#ff4d6d",
  info: "#00f7ff",

  white: "#ffffff",
  black: "#000000"
} as const;

/**
 * Type for palette keys, ensures autocompletion.
 */
export type ColorKey = keyof typeof COLORS;

/**
 * Utility: Returns an RGBA string with adjustable opacity.
 *
 * Example:
 *   withAlpha("accent", 0.5) → "rgba(0, 247, 255, 0.5)"
 */
export function withAlpha(key: ColorKey, alpha: number): string {
  const hex = COLORS[key];
  if (!hex) throw new Error(`Unknown color key: ${key}`);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Utility: Returns a glow box-shadow string for neon effects.
 *
 * Example:
 *   glowShadow("accent") →
 *   "0 0 6px #00f7ff, 0 0 12px #00f7ff"
 */
export function glowShadow(key: ColorKey, intensity: number = 1): string {
  const color = COLORS[key];
  const blur1 = 6 * intensity;
  const blur2 = 12 * intensity;
  return `0 0 ${blur1}px ${color}, 0 0 ${blur2}px ${color}`;
}

/**
 * Utility: Returns a gradient string for holographic surfaces.
 *
 * Example:
 *   holoGradient() →
 *   "linear-gradient(135deg, rgba(0,247,255,0.2), rgba(255,0,127,0.15))"
 */
export function holoGradient(alpha1: number = 0.2, alpha2: number = 0.15): string {
  return `linear-gradient(135deg, ${withAlpha("accent", alpha1)}, ${withAlpha("accentAlt", alpha2)})`;
}
