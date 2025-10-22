/**
 * src/components/terminal/TerminalOverlay.jsx
 * ---------------------------------------------------------------------------
 * A draggable, keyboard-toggleable “terminal overlay” for your sci-fi portfolio.
 * Great for easter eggs or a power-user launcher (⌃/Ctrl + ` to toggle).
 *
 * Highlights
 * - Draggable overlay window with neon/sci-fi chrome (no external libs)
 * - Typewriter boot banner + smooth scrollback
 * - Command history (↑/↓), autocomplete hint (Tab)
 * - Built-in commands: help, clear, echo, about, skills, projects, contact,
 *   date, time, open <url>, github, resume, theme <holo|dark|light>
 * - Extensible via `commands` prop (sync or async handlers)
 * - Accessible: proper roles, focus trap on open, keyboard shortcuts
 *
 * Props
 * - isOpen?: boolean              Control visibility (uncontrolled if omitted)
 * - onClose?: () => void          Called when overlay requests close (Esc/Close)
 * - title?: string                Window title text (“ACCESS TERMINAL” default)
 * - initialLines?: string[]       Lines shown after boot banner
 * - commands?: Record<string, (args:string[], api:CmdAPI)=>Promise<string|string[]>|string|string[]>
 * - hotkey?: string               Keyboard shortcut to toggle (default: "Ctrl+`")
 * - startTheme?: "holo"|"dark"|"light"   Default theme (default: "holo")
 * - defaultPosition?: {x:number, y:number}  Initial top-left position (px)
 * - defaultSize?: {w:number, h:number}   Initial size (px)
 *
 * Usage (Astro or React):
 * ---
 * import TerminalOverlay from "@/components/terminal/TerminalOverlay.jsx";
 * ---
 * <TerminalOverlay client:visible />
 *
 * Styling
 * - Tailwind CSS classes assumed (dark UI). Adjust colors to match your brand.
 *
 * License
 * - MIT — drop-in and tweak freely.
 * ---------------------------------------------------------------------------
 */

import React from "react";

// ---------- Utilities ----------
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const nowHHMMSS = () => new Date().toLocaleTimeString();
const fmtDate = () => new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });

/** Simple tokenizer that preserves quoted strings. */
function tokenize(input) {
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  const out = [];
  let m;
  while ((m = re.exec(input))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

// ---------- Component ----------
export default function TerminalOverlay({
  isOpen: isOpenProp,
  onClose,
  title = "ACCESS TERMINAL",
  initialLines = [
    "Type 'help' to list commands.",
    "Try: projects, skills, about, theme holo",
  ],
  commands: userCommands,
  hotkey = "Ctrl+`",
  startTheme = "holo",
  defaultPosition = { x: 64, y: 64 },
  defaultSize = { w: 820, h: 420 },
}) {
  // Controlled/uncontrolled visibility
  const [internalOpen, setInternalOpen] = React.useState(true);
  const isControlled = typeof isOpenProp === "boolean";
  const isOpen = isControlled ? isOpenProp : internalOpen;

  const [theme, setTheme] = React.useState(startTheme); // holo | dark | light
  const [pos, setPos] = React.useState(defaultPosition);
  const [size, setSize] = React.useState(defaultSize);
  const [dragState, setDragState] = React.useState(null);

  const [lines, setLines] = React.useState(() => []);
  const [bootDone, setBootDone] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [history, setHistory] = React.useState([]);
  const [histIdx, setHistIdx] = React.useState(-1);
  const [suggestion, setSuggestion] = React.useState("");

  const wrapRef = React.useRef(null);
  const scrollRef = React.useRef(null);
  const inputRef = React.useRef(null);

  // --- Built-in commands (can be overridden by userCommands) ---
  const builtin = React.useMemo(() => {
    /** @type {Record<string, (args: string[], api: CmdAPI) => any>} */
    return {
      help: (_args, api) => [
        "Available commands:",
        "  help                Show this help",
        "  clear               Clear the screen",
        "  echo <text>         Print text",
        "  about               Who is Zeshan?",
        "  skills              Tech stack overview",
        "  projects            List featured projects",
        "  contact             How to reach me",
        "  date | time         Show current date / time",
        "  github              Open GitHub profile",
        "  resume              Open resume PDF",
        "  open <url>          Open a URL",
        "  theme <holo|dark|light>   Switch terminal theme",
      ],
      clear: () => {
        setLines([]);
        return "";
      },
      echo: (args) => args.join(" "),
      about: () => [
        "User: Zeshan Basaran",
        "Specialization: Pattern Recognition & Predictive Modeling",
        "Clearance: Data Analyst / Computer Scientist",
        "Motto: Analyzing patterns, engineering solutions, shaping the future.",
      ],
      skills: () => [
        "Languages: Python, Java, Kotlin, SQL, JavaScript/TypeScript, Go (learning)",
        "Data: pandas, scikit-learn, Plotly, Dash, Streamlit, NumPy",
        "Web: Astro, React, Tailwind, Node, REST APIs",
        "DB: SQLite, MySQL, Postgres",
        "Tools: Git, Docker, Jupyter, VS Code",
      ],
      projects: () => [
        "1) Systematic Trading Backtester & Risk Monitor  —  Python + Streamlit",
        "2) Quantitative Factor Analytics Platform        —  Python + Dash",
        "3) Sci-Fi Portfolio (this site)                 —  Astro + Tailwind",
        "Tip: click Projects in the top nav for interactive previews.",
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
        // Adjust to your actual resume path
        api.open("/resume.pdf");
        return "Opening resume…";
      },
      open: (args, api) => {
        if (!args[0]) return "Usage: open <url>";
        const url = /^https?:\/\//i.test(args[0]) ? args[0] : `https://${args[0]}`;
        api.open(url);
        return `Opening ${url}…`;
      },
      theme: (args) => {
        const t = (args[0] || "").toLowerCase();
        if (!["holo", "dark", "light"].includes(t)) {
          return "Usage: theme <holo|dark|light>";
        }
        setTheme(t);
        return `Theme set to ${t}.`;
      },
    };
  }, []);

  // Merge with user-provided commands
  const commands = React.useMemo(() => ({ ...builtin, ...(userCommands || {}) }), [builtin, userCommands]);

  const commandNames = React.useMemo(() => Object.keys(commands).sort(), [commands]);

  // --- Hotkey: Ctrl+` to toggle
  React.useEffect(() => {
    function handler(e) {
      const isBacktick = e.key === "`";
      const wantCtrl = /Ctrl\+`/i.test(hotkey);
      const ok = isBacktick && (!!e.ctrlKey === wantCtrl);
      if (ok) {
        e.preventDefault();
        if (isControlled) {
          // If controlled, request close/open through onClose if closing
          if (isOpen && onClose) onClose();
          // If closed, we cannot open externally; document it in README if needed
        } else {
          setInternalOpen((v) => !v);
        }
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hotkey, isOpen, isControlled, onClose]);

  // --- Focus trap: focus input when open
  React.useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  // --- Boot banner + initial lines (typewriter)
  React.useEffect(() => {
    if (!isOpen || bootDone) return;
    let cancelled = false;

    const boot = async () => {
      const banner = [
        ">> INITIALIZING NEURAL INTERFACE…",
        ">> HANDSHAKE OK.",
        ">> ACCESS GRANTED.",
      ];
      for (const line of banner) {
        if (cancelled) return;
        await appendType(line, 10);
      }
      if (cancelled) return;
      appendLine(""); // spacer
      for (const line of initialLines) {
        if (cancelled) return;
        await appendType(line, 5);
      }
      setBootDone(true);
    };

    boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // --- Append helpers ---
  const appendLine = React.useCallback((text) => {
    setLines((prev) => [...prev, text]);
    // scroll to bottom next frame
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const appendType = React.useCallback(
    (text, delay = 8) =>
      new Promise((resolve) => {
        let i = 0;
        const tick = () => {
          appendLine(text.slice(0, i + 1));
          i++;
          if (i < text.length) setTimeout(tick, delay);
          else resolve(null);
        };
        tick();
      }),
    [appendLine]
  );

  // --- Dragging the window (titlebar mousedown -> move) ---
  const onDragStart = (e) => {
    if (!isOpen) return;
    const rect = wrapRef.current?.getBoundingClientRect();
    setDragState({
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      boundsW: window.innerWidth,
      boundsH: window.innerHeight,
      rectW: rect?.width ?? size.w,
      rectH: rect?.height ?? size.h,
    });
    e.preventDefault();
  };
  const onDragMove = React.useCallback(
    (e) => {
      if (!dragState) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      const nx = clamp(dragState.origX + dx, 8 - dragState.rectW, dragState.boundsW - 8);
      const ny = clamp(dragState.origY + dy, 8, dragState.boundsH - 48);
      setPos({ x: nx, y: ny });
    },
    [dragState]
  );
  const onDragEnd = React.useCallback(() => setDragState(null), []);

  React.useEffect(() => {
    if (!dragState) return;
    const mm = (e) => onDragMove(e);
    const mu = () => onDragEnd();
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
    return () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
    };
  }, [dragState, onDragMove, onDragEnd]);

  // --- Input handling ---
  const runCommand = React.useCallback(
    async (raw) => {
      if (!raw.trim()) return;
      // Print the prompt + command
      appendLine(`$ ${raw}`);
      setHistory((h) => [...h.slice(-99), raw]);
      setHistIdx(-1);

      const [cmd, ...args] = tokenize(raw);
      const handler = commands[cmd];
      /** @type {CmdAPI} */
      const api = {
        print: appendLine,
        open: (url) => window.open(url, "_blank", "noopener,noreferrer"),
        setTheme,
      };

      try {
        if (!handler) {
          appendLine(`Command not found: ${cmd}. Type 'help'.`);
          return;
        }
        const result = await handler(args, api);
        if (Array.isArray(result)) result.forEach((ln) => appendLine(String(ln)));
        else if (typeof result === "string" && result.length) appendLine(result);
      } catch (err) {
        appendLine(String(err?.message || err || "Unknown error"));
      }
    },
    [appendLine, commands]
  );

  const onKeyDown = (e) => {
    // History nav
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!history.length) return;
      const ni = histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(ni);
      setInput(history[ni]);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx < 0) return;
      const ni = histIdx + 1;
      if (ni >= history.length) {
        setHistIdx(-1);
        setInput("");
      } else {
        setHistIdx(ni);
        setInput(history[ni]);
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const val = input;
      setInput("");
      setSuggestion("");
      runCommand(val);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      // Simple autocomplete on first token
      const [tok] = tokenize(input);
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
    if (e.key === "Escape") {
      e.preventDefault();
      handleClose();
    }
  };

  // Autocomplete hint while typing
  React.useEffect(() => {
    const [tok] = tokenize(input);
    if (!tok) {
      setSuggestion("");
      return;
    }
    const matches = commandNames.filter((c) => c.startsWith(tok));
    setSuggestion(matches.length === 1 ? matches[0] : "");
  }, [input, commandNames]);

  const copyAll = async () => {
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      appendLine("[copied scrollback to clipboard]");
    } catch {
      appendLine("[copy failed — permissions?]");
    }
  };

  const handleClose = () => {
    if (onClose) onClose();
    if (!isControlled) setInternalOpen(false);
  };

  // Close on background click (outside window)
  const onBgClick = (e) => {
    if (e.target === e.currentTarget) handleClose();
  };

  // Theming tokens
  const themeVars = (() => {
    switch (theme) {
      case "light":
        return {
          paper: "bg-white/90",
          border: "border-slate-300",
          text: "text-slate-800",
          chrome: "from-slate-100/90 to-slate-200/80",
          glow: "shadow-[0_0_32px_-8px_rgba(14,165,233,0.25)]",
          prompt: "text-sky-600",
          caret: "bg-slate-800",
          grid: "bg-gradient-to-b",
        };
      case "dark":
        return {
          paper: "bg-slate-950/85",
          border: "border-slate-800/70",
          text: "text-slate-200",
          chrome: "from-slate-950/60 to-slate-900/40",
          glow: "shadow-[0_0_40px_-12px_rgba(56,189,248,0.35)]",
          prompt: "text-sky-400",
          caret: "bg-slate-200",
          grid: "bg-gradient-to-b",
        };
      case "holo":
      default:
        return {
          paper: "bg-slate-950/75",
          border: "border-sky-400/25",
          text: "text-slate-200",
          chrome: "from-slate-950/60 to-slate-900/40",
          glow: "shadow-[0_0_50px_-12px_rgba(56,189,248,0.5)]",
          prompt: "text-sky-300",
          caret: "bg-sky-300",
          grid: "bg-gradient-to-b",
        };
    }
  })();

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Terminal overlay"
      className="fixed inset-0 z-[90]"
      onMouseUp={onDragEnd}
      onMouseMove={onDragMove}
      onClick={onBgClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />

      {/* Window */}
      <div
        ref={wrapRef}
        className={[
          "absolute select-none",
          themeVars.glow,
          "rounded-2xl border",
          themeVars.border,
          themeVars.paper,
          "w-[min(95vw,1200px)]",
        ].join(" ")}
        style={{
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          width: `${size.w}px`,
          height: `${size.h}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Titlebar */}
        <div
          className={[
            "flex items-center justify-between gap-3",
            "rounded-t-2xl px-3 py-2",
            themeVars.grid,
            themeVars.chrome,
            "border-b",
            themeVars.border,
            "cursor-grab active:cursor-grabbing",
          ].join(" ")}
          onMouseDown={onDragStart}
        >
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-rose-400/80" />
            <span className="inline-block h-3 w-3 rounded-full bg-amber-300/80" />
            <span className="inline-block h-3 w-3 rounded-full bg-emerald-400/80" />
            <h3 className="ml-2 text-xs font-semibold tracking-widest text-sky-300/90">
              {title}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-sky-400/20 bg-slate-900/40 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-900/60"
              onClick={copyAll}
              title="Copy log"
            >
              Copy
            </button>
            <button
              className="rounded-md border border-sky-400/20 bg-slate-900/40 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-900/60"
              onClick={() => {
                setLines([]);
                setBootDone(true);
              }}
              title="Clear"
            >
              Clear
            </button>
            <button
              className="rounded-md border border-rose-400/30 bg-rose-900/30 px-2 py-1 text-[11px] text-rose-100 hover:bg-rose-900/50"
              onClick={handleClose}
              title="Close (Esc)"
            >
              Close
            </button>
          </div>
        </div>

        {/* Console area */}
        <div className="flex h-[calc(100%-40px)] flex-col">
          <div
            ref={scrollRef}
            className={[
              "custom-scrollbar",
              "relative flex-1 overflow-auto px-4 py-3",
              themeVars.text,
              "font-mono text-[12.5px] leading-6",
              "bg-[radial-gradient(ellipse_at_top_left,rgba(56,189,248,0.08),transparent_35%),radial-gradient(ellipse_at_bottom_right,rgba(56,189,248,0.06),transparent_40%)]",
            ].join(" ")}
          >
            {/* Scrollback */}
            {lines.map((ln, i) => (
              <Line key={i} text={ln} />
            ))}

            {/* Prompt */}
            <div className="flex items-center gap-2">
              <span className={["font-bold", themeVars.prompt].join(" ")}>$</span>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                className={[
                  "min-w-0 flex-1 bg-transparent outline-none",
                  themeVars.text,
                  "placeholder:text-slate-400/60",
                ].join(" ")}
                placeholder="enter command… (help)"
                aria-label="Terminal input"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {/* Blinking caret (purely cosmetic) */}
              <span className={["ml-1 h-4 w-[2px] animate-pulse", themeVars.caret].join(" ")} />
            </div>

            {/* Suggestion row */}
            {!!suggestion && (
              <div className="mt-1 pl-5 text-[11px] text-slate-400/70">{suggestion}</div>
            )}

            {/* Bottom spacer to keep prompt above edge */}
            <div className="h-2" />
          </div>

          {/* Footer / status bar */}
          <div
            className={[
              "flex items-center justify-between gap-3 border-t px-3 py-1.5",
              themeVars.border,
              "text-[11px] text-slate-400/80",
              themeVars.grid,
              themeVars.chrome,
            ].join(" ")}
          >
            <div>
              {theme.toUpperCase()} • {fmtDate()} {nowHHMMSS()}
            </div>
            <div className="hidden sm:block">Hotkey: {hotkey} • Esc to close</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Small subcomponents ----------

function Line({ text }) {
  // Linkify http/https
  const html = React.useMemo(() => {
    if (!text) return "";
    const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return esc.replace(
      /(https?:\/\/[^\s)]+)|(www\.[^\s)]+)/g,
      (m) => `<a href="${/^https?:\/\//.test(m) ? m : "https://" + m}" target="_blank" rel="noopener noreferrer" class="underline decoration-dotted hover:text-sky-300">${m}</a>`
    );
  }, [text]);
  return <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * @typedef {Object} CmdAPI
 * @property {(s: string) => void} print  Append a line to the terminal
 * @property {(url: string) => void} open   Open a new browser tab
 * @property {(t: "holo"|"dark"|"light") => void} setTheme  Switch theme
 */
