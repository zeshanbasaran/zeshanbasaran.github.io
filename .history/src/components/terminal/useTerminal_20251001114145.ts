/**
 * src/components/terminal/useTerminal.ts
 * -----------------------------------------------------------------------------
 * A reusable React hook that powers a sci-fi terminal:
 * - Scrollback lines w/ typewriter helper
 * - Command registry (sync/async), history, autocomplete
 * - Built-in commands: help, clear, echo, date, time, theme, open, about, skills,
 *   projects, contact, github, resume
 *
 * Pair it with a UI shell (e.g., TerminalOverlay.jsx) or build your own:
 *
 * Example
 * -------
 * const {
 *   lines, input, setInput, onKeyDown, runCommand,
 *   suggestion, theme, setTheme, appendLine, clear
 * } = useTerminal();
 *
 * <pre>{lines.join("\n")}</pre>
 * <input
 *   value={input}
 *   onChange={e => setInput(e.target.value)}
 *   onKeyDown={onKeyDown}
 * />
 *
 * Design Notes
 * ------------
 * - No DOM dependencies; UI handles focus/scroll.
 * - Typed command API; easy to extend/override built-ins via options.commands.
 * - Autocomplete on first token (Tab) and history nav (↑/↓).
 *
 * License
 * -------
 * MIT — Use freely in your portfolio.
 * -----------------------------------------------------------------------------
 */

import * as React from "react";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** API given to command handlers for side-effects. */
export interface CmdAPI {
  /** Append a line to the scrollback. */
  print: (line: string) => void;
  /** Open a URL (default opens new tab, can be overridden by onOpenURL). */
  open: (url: string) => void;
  /** Set terminal theme token. */
  setTheme: (theme: TerminalTheme) => void;
}

export type CommandResult = void | string | string[] | Promise<void | string | string[]>;

export type CommandHandler = (args: string[], api: CmdAPI) => CommandResult;

export type CommandRegistry = Record<string, CommandHandler>;

export type TerminalTheme = "holo" | "dark" | "light";

export interface UseTerminalOptions {
  /** Initial scrollback lines shown after boot/typewriter. */
  initialLines?: string[];
  /** Starting theme token. */
  startTheme?: TerminalTheme;
  /** Custom / overriding commands. */
  commands?: CommandRegistry;
  /** Intercept URL openings (tests, in-app router, analytics, etc.). */
  onOpenURL?: (url: string) => void;
  /** Maximum history length (default 100). */
  historyMax?: number;
}

export interface UseTerminalReturn {
  // State
  lines: string[];
  input: string;
  suggestion: string;
  theme: TerminalTheme;
  history: string[];
  historyIndex: number;

  // Core actions
  setInput: React.Dispatch<React.SetStateAction<string>>;
  setTheme: (t: TerminalTheme) => void;
  appendLine: (line: string) => void;
  appendType: (line: string, charDelay?: number) => Promise<void>;
  clear: () => void;
  runCommand: (raw: string) => Promise<void>;

  // Keyboard helper (bind to your input)
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;

  // Registry (read-only)
  commands: CommandRegistry;

  // Utils
  tokenize: (s: string) => string[];
}

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const nowHHMMSS = () => new Date().toLocaleTimeString();
const fmtDate = () =>
  new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });

/** Tokenize preserving quoted substrings. */
export function tokenizeQuoted(input: string): string[] {
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

// -----------------------------------------------------------------------------
// Built-in commands (can be overridden by options.commands)
// -----------------------------------------------------------------------------

function createBuiltinCommands(): CommandRegistry {
  return {
    help: (_args, _api) => [
      "Available commands:",
      "  help                      Show this help",
      "  clear                     Clear the screen",
      "  echo <text>               Print text",
      "  about                     Who is Zeshan?",
      "  skills                    Tech stack overview",
      "  projects                  List featured projects",
      "  contact                   How to reach me",
      "  date | time               Show current date / time",
      "  github                    Open GitHub profile",
      "  resume                    Open resume PDF",
      "  open <url>                Open a URL",
      "  theme <holo|dark|light>   Switch terminal theme",
    ],
    clear: (_args, api) => {
      api.print("__CLEAR__"); // sentinel handled by hook
    },
    echo: (args) => args.join(" "),
    about: () => [
      "User: Zeshan Basaran",
      "Specialization: Pattern Recognition & Predictive Modeling",
      "Clearance: Data Analyst / Computer Scientist",
      "Motto: Analyzing patterns, engineering solutions, shaping the future.",
    ],
    skills: () => [
      "Languages: Python, Java, Kotlin, SQL, JS/TS, Go (learning)",
      "Data: pandas, scikit-learn, Plotly, Dash, Streamlit, NumPy",
      "Web: Astro, React, Tailwind, Node, REST APIs",
      "DB: SQLite, MySQL, Postgres",
      "Tools: Git, Docker, Jupyter, VS Code",
    ],
    projects: () => [
      "1) Systematic Trading Backtester & Risk Monitor  —  Python + Streamlit",
      "2) Quantitative Factor Analytics Platform        —  Python + Dash",
      "3) Sci-Fi Portfolio (this site)                 —  Astro + Tailwind",
      "Tip: open the Projects page for interactive previews.",
    ],
    contact: () => [
      "Email: zeshanbasaran@gmail.com",
      "LinkedIn: /in/zeshanbasaran",
      "Location: Baltimore, MD (US-ET)",
    ],
    date: () => fmtDate(),
    time: () => nowHHMMSS(),
    github: (_args, api) => {
      api.open("https://github.com/zeshanbasaran");
      return "Opening GitHub in a new tab…";
    },
    resume: (_args, api) => {
      api.open("/resume.pdf");
      return "Opening resume…";
    },
    open: (args, api) => {
      if (!args[0]) return "Usage: open <url>";
      const url = /^https?:\/\//i.test(args[0]) ? args[0] : `https://${args[0]}`;
      api.open(url);
      return `Opening ${url}…`;
    },
    theme: (args, api) => {
      const t = (args[0] || "").toLowerCase() as TerminalTheme;
      if (!["holo", "dark", "light"].includes(t)) {
        return "Usage: theme <holo|dark|light>";
      }
      api.setTheme(t);
      return `Theme set to ${t}.`;
    },
  };
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useTerminal(options: UseTerminalOptions = {}): UseTerminalReturn {
  const {
    initialLines = ["Type 'help' to list commands.", "Try: projects, skills, about, theme holo"],
    startTheme = "holo",
    commands: overrides,
    onOpenURL,
    historyMax = 100,
  } = options;

  const [lines, setLines] = React.useState<string[]>([...initialLines]);
  const [input, setInput] = React.useState<string>("");
  const [suggestion, setSuggestion] = React.useState<string>("");
  const [theme, setTheme] = React.useState<TerminalTheme>(startTheme);
  const [history, setHistory] = React.useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState<number>(-1);

  // registry (built-ins overridden by user commands)
  const registry = React.useMemo<CommandRegistry>(
    () => ({ ...createBuiltinCommands(), ...(overrides || {}) }),
    [overrides]
  );

  const commandNames = React.useMemo<string[]>(
    () => Object.keys(registry).sort(),
    [registry]
  );

  // API provided to commands
  const api = React.useMemo<CmdAPI>(
    () => ({
      print: (line: string) => {
        if (line === "__CLEAR__") {
          setLines([]);
          return;
        }
        setLines((prev) => [...prev, line]);
      },
      open: (url: string) => {
        if (onOpenURL) onOpenURL(url);
        else if (typeof window !== "undefined") {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      },
      setTheme: (t: TerminalTheme) => setTheme(t),
    }),
    [onOpenURL]
  );

  // External helpers
  const appendLine = React.useCallback((line: string) => {
    setLines((prev) => [...prev, line]);
  }, []);

  const appendType = React.useCallback(
    (line: string, charDelay = 8) =>
      new Promise<void>((resolve) => {
        let i = 0;
        const tick = () => {
          setLines((prev) => [...prev, line.slice(0, i + 1)]);
          i++;
          if (i < line.length) setTimeout(tick, charDelay);
          else resolve();
        };
        tick();
      }),
    []
  );

  const clear = React.useCallback(() => setLines([]), []);

  // Command execution
  const runCommand = React.useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;

      // Echo the prompt + command
      setLines((prev) => [...prev, `$ ${trimmed}`]);

      // Maintain history
      setHistory((prev) => [...prev.slice(-historyMax + 1), trimmed]);
      setHistoryIndex(-1);

      // Tokenize and execute
      const [cmd, ...args] = tokenizeQuoted(trimmed);
      const handler = registry[cmd];

      if (!handler) {
        setLines((prev) => [...prev, `Command not found: ${cmd}. Type 'help'.`]);
        return;
      }

      try {
        const out = await handler(args, api);
        if (Array.isArray(out)) setLines((prev) => [...prev, ...out.map(String)]);
        else if (typeof out === "string" && out.length) setLines((prev) => [...prev, out]);
      } catch (err: any) {
        setLines((prev) => [...prev, String(err?.message || err || "Unknown error")]);
      }
    },
    [api, registry, historyMax]
  );

  // Keyboard handler (bind to your input element)
  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // History navigation
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!history.length) return;
        const ni = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(ni);
        setInput(history[ni]);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex < 0) return;
        const ni = historyIndex + 1;
        if (ni >= history.length) {
          setHistoryIndex(-1);
          setInput("");
        } else {
          setHistoryIndex(ni);
          setInput(history[ni]);
        }
        return;
      }

      // Submit
      if (e.key === "Enter") {
        e.preventDefault();
        const val = input;
        setInput("");
        setSuggestion("");
        void runCommand(val);
        return;
      }

      // Autocomplete (first token)
      if (e.key === "Tab") {
        e.preventDefault();
        const [tok] = tokenizeQuoted(input);
        if (!tok) return;
        const matches = commandNames.filter((c) => c.startsWith(tok));
        if (matches.length === 1) {
          const rest = input.replace(/^\S+/, matches[0]);
          setInput(rest);
          setSuggestion("");
        } else if (matches.length > 1) {
          setSuggestion(matches.join("  "));
        }
        return;
      }
    },
    [history, historyIndex, input, runCommand, commandNames]
  );

  // Live suggestion update while typing
  React.useEffect(() => {
    const [tok] = tokenizeQuoted(input);
    if (!tok) {
      setSuggestion("");
      return;
    }
    const matches = commandNames.filter((c) => c.startsWith(tok));
    setSuggestion(matches.length === 1 ? matches[0] : "");
  }, [input, commandNames]);

  return {
    // state
    lines,
    input,
    suggestion,
    theme,
    history,
    historyIndex,

    // actions
    setInput,
    setTheme,
    appendLine,
    appendType,
    clear,
    runCommand,

    // keyboard
    onKeyDown,

    // registry
    commands: registry,

    // utils
    tokenize: tokenizeQuoted,
  };
}

// Default export for convenience
export default useTerminal;
