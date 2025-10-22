/**
 * src/components/dashboards/PlotlyPanel.jsx
 * ------------------------------------------------------------
 * A full-featured Plotly chart panel for dashboard sections and
 * detail views. Bigger sibling of PlotlyMini with controls,
 * legend, annotations support, and optional fullscreen.
 *
 * Design goals
 * - Lazy-load Plotly to keep initial bundles lean
 * - Resizes with ResizeObserver and on fullscreen changes
 * - Good defaults for dark/sci-fi UI, easily themeable
 * - Optional toolbar (reset, download, toggle-legend, fullscreen)
 * - Accepts arbitrary traces/layout/config; non-destructive merging
 * - Emits plot events (relayout, click) to parent via callbacks
 *
 * Props
 * - data:        Plotly traces (Array). Required for real charts; a demo trace is used if omitted.
 * - layout:      Plotly layout overrides (Object).
 * - config:      Plotly config overrides (Object).
 * - height:      Height in px (Number). Default: 360.
 * - title:       String (panel header).
 * - subtitle:    String (small helper text).
 * - theme:       "dark" | "light" | "holo" (Default: "holo")
 * - showToolbar: Boolean to show top-right controls (Default: true)
 * - defaultLegend: Boolean to show legend initially (Default: true)
 * - interactive: Enable pan/zoom/hover (Default: true)
 * - onRelayout:  Function(e) -> void (fires on zoom/pan/resize)
 * - onClick:     Function(e) -> void (fires on point clicks)
 * - className:   Extra classes for outer wrapper
 *
 * Usage (Astro / React):
 * ---
 * import PlotlyPanel from "@/components/dashboards/PlotlyPanel.jsx";
 * const traces = [{ x, y, type: "scatter", mode:"lines" }];
 * ---
 * <PlotlyPanel client:visible title="AAPL • Price"
 *   data={traces}
 *   height={420}
 *   theme="holo"
 * />
 *
 * Notes
 * - Uses `plotly.js-dist-min` for DOM-friendly bundle.
 * - This component avoids Plotly Express; pass prepared traces.
 * - Fullscreen uses the standard Fullscreen API.
 * ------------------------------------------------------------
 */

import React from "react";

export default function PlotlyPanel({
  data,
  layout,
  config,
  height = 360,
  title,
  subtitle,
  theme = "holo",
  showToolbar = true,
  defaultLegend = true,
  interactive = true,
  onRelayout,
  onClick,
  className = "",
}) {
  const wrapRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const plotInstRef = React.useRef(null);   // div that Plotly binds to
  const PlotlyModuleRef = React.useRef(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [legendVisible, setLegendVisible] = React.useState(defaultLegend);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  // Demo fallback trace if no data provided
  const fallbackTraces = React.useMemo(() => {
    const n = 120;
    const xs = Array.from({ length: n }, (_, i) => i);
    const ys = xs.map((i) => 100 + Math.sin(i / 8) * 10 + (i * 0.15));
    return [
      {
        x: xs,
        y: ys,
        type: "scatter",
        mode: "lines",
        line: { width: 2 },
        name: "demo",
        hoverinfo: "skip",
      },
    ];
  }, []);

  // Theme presets (paper/plot bg, fonts, gridlines, accent)
  const themeVars = React.useMemo(() => {
    switch (theme) {
      case "light":
        return {
          paper: "#ffffff",
          plot: "#ffffff",
          font: "#334155", // slate-700
          grid: "rgba(30,41,59,0.1)", // slate-800 @10%
          accent: "#0ea5e9", // sky-500
          hoverBg: "rgba(241,245,249,0.95)", // slate-100ish
          hoverFont: "#0f172a",
          ring: "ring-sky-500/20",
          border: "border-slate-200",
          glow: "shadow-[0_0_24px_-8px_rgba(14,165,233,0.25)]",
        };
      case "dark":
        return {
          paper: "rgba(2,6,23,0.85)", // slate-950-ish
          plot: "rgba(2,6,23,0.0)",
          font: "#cbd5e1", // slate-300
          grid: "rgba(148,163,184,0.15)", // slate-400 @15%
          accent: "#38bdf8", // sky-400
          hoverBg: "rgba(2,6,23,0.9)",
          hoverFont: "#e2f2ff",
          ring: "ring-sky-400/15",
          border: "border-slate-800/60",
          glow: "shadow-[0_0_28px_-8px_rgba(56,189,248,0.35)]",
        };
      case "holo":
      default:
        return {
          paper: "rgba(2,6,23,0.75)",
          plot: "rgba(2,6,23,0.0)",
          font: "#d1e9ff",
          grid: "rgba(96,165,250,0.18)", // sky-400 @18%
          accent: "#60a5fa",
          hoverBg: "rgba(2,6,23,0.9)",
          hoverFont: "#e5f2ff",
          ring: "ring-sky-400/20",
          border: "border-sky-400/20",
          glow: "shadow-[0_0_40px_-12px_rgba(56,189,248,0.45)]",
        };
    }
  }, [theme]);

  // Base layout (merged with user layout)
  const baseLayout = React.useMemo(() => {
    return {
      paper_bgcolor: themeVars.paper,
      plot_bgcolor: themeVars.plot,
      margin: { l: 48, r: 24, t: 48, b: 40, pad: 0 },
      height, // updated by prop/resize
      font: { family: "ui-sans-serif, system-ui, Segoe UI, Roboto", color: themeVars.font, size: 12 },
      xaxis: {
        showgrid: true,
        gridcolor: themeVars.grid,
        zeroline: false,
        showline: false,
        ticks: "outside",
        ticklen: 4,
        tickcolor: themeVars.grid,
        automargin: true,
      },
      yaxis: {
        showgrid: true,
        gridcolor: themeVars.grid,
        zeroline: false,
        showline: false,
        ticks: "outside",
        ticklen: 4,
        tickcolor: themeVars.grid,
        automargin: true,
      },
      legend: {
        orientation: "h",
        y: 1.02,
        x: 0,
        xanchor: "left",
        yanchor: "bottom",
        bgcolor: "rgba(0,0,0,0)",
        font: { size: 11, color: themeVars.font },
      },
      shapes: [
        // subtle top divider glow
        {
          type: "line",
          x0: 0, x1: 1, xref: "paper",
          y0: 1, y1: 1, yref: "paper",
          line: { color: "rgba(96,165,250,0.25)", width: 1 },
        },
      ],
      hoverlabel: {
        bgcolor: themeVars.hoverBg,
        bordercolor: themeVars.accent,
        font: { color: themeVars.hoverFont, size: 12 },
        namelength: 24,
      },
      // let us toggle legend visibility
      showlegend: legendVisible,
    };
  }, [themeVars, height, legendVisible]);

  // Base config (merged with user config)
  const baseConfig = React.useMemo(() => {
    return {
      responsive: true,
      displayModeBar: false, // we provide our own toolbar
      scrollZoom: interactive,
      doubleClick: interactive ? "reset+autosize" : false,
      staticPlot: !interactive,
      toImageButtonOptions: { format: "png", filename: "chart", scale: 2 },
    };
  }, [interactive]);

  // Load Plotly once
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!PlotlyModuleRef.current) {
          PlotlyModuleRef.current = (await import("plotly.js-dist-min")).default;
        }
        if (!cancelled) setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load Plotly");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Render / re-render
  const renderPlot = React.useCallback(async () => {
    if (!containerRef.current || !PlotlyModuleRef.current) return;
    setIsLoading(true);

    const traces = (data && data.length ? data : fallbackTraces).map((t) => ({
      hovertemplate:
        interactive ? (t.hovertemplate ?? "%{x}, %{y}<extra>%{fullData.name}</extra>") : undefined,
      ...t,
    }));

    const mergedLayout = {
      ...baseLayout,
      ...(layout || {}),
      height, // enforce prop height after merge
      showlegend: legendVisible,
    };
    const mergedConfig = { ...baseConfig, ...(config || {}) };

    try {
      if (plotInstRef.current) {
        await PlotlyModuleRef.current.react(containerRef.current, traces, mergedLayout, mergedConfig);
      } else {
        await PlotlyModuleRef.current.newPlot(containerRef.current, traces, mergedLayout, mergedConfig);
        plotInstRef.current = containerRef.current;
        // Event hooks
        containerRef.current.on("plotly_relayout", (e) => onRelayout && onRelayout(e));
        containerRef.current.on("plotly_click", (e) => onClick && onClick(e));
      }
      setIsLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to render chart");
      setIsLoading(false);
    }
  }, [data, fallbackTraces, baseLayout, baseConfig, layout, config, height, interactive, legendVisible, onRelayout, onClick]);

  React.useEffect(() => {
    renderPlot();
  }, [renderPlot]);

  // Resize handling
  React.useEffect(() => {
    if (!containerRef.current || !PlotlyModuleRef.current) return;
    const ro = new ResizeObserver(() => {
      if (PlotlyModuleRef.current && plotInstRef.current) {
        PlotlyModuleRef.current.Plots.resize(containerRef.current);
      }
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Fullscreen change listener
  React.useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (PlotlyModuleRef.current && plotInstRef.current) {
        try {
          PlotlyModuleRef.current.purge(plotInstRef.current);
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  // Toolbar actions
  const handleReset = async () => {
    if (!PlotlyModuleRef.current || !containerRef.current) return;
    try {
      await PlotlyModuleRef.current.relayout(containerRef.current, {
        "xaxis.autorange": true,
        "yaxis.autorange": true,
      });
    } catch {}
  };

  const handleDownload = async () => {
    if (!PlotlyModuleRef.current || !containerRef.current) return;
    try {
      await PlotlyModuleRef.current.downloadImage(containerRef.current, {
        format: "png",
        filename: (title ? title.replace(/\s+/g, "_").toLowerCase() : "chart"),
        scale: 2,
      });
    } catch {}
  };

  const handleToggleLegend = () => {
    setLegendVisible((v) => !v);
  };

  const handleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await wrapRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
      // resize once toggled (some browsers need a tiny delay)
      setTimeout(() => {
        if (PlotlyModuleRef.current && containerRef.current) {
          PlotlyModuleRef.current.Plots.resize(containerRef.current);
        }
      }, 100);
    } catch {}
  };

  const clickable = typeof onClick === "function";

  return (
    <section
      ref={wrapRef}
      className={[
        "relative rounded-2xl",
        "border",
        themeVars.border,
        "bg-gradient-to-b from-slate-950/60 to-slate-900/40",
        themeVars.glow,
        "backdrop-blur",
        "transition-shadow duration-300",
        clickable ? "cursor-crosshair" : "",
        className,
      ].join(" ")}
      aria-label={title ? `Chart panel: ${title}` : "Chart panel"}
    >
      {/* Header */}
      {(title || subtitle || showToolbar) && (
        <header
          className={[
            "flex items-start justify-between gap-3 px-4 pt-3",
          ].join(" ")}
        >
          <div className="min-w-0">
            {title && (
              <h3 className="truncate text-sm font-medium tracking-wide text-sky-300/90">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-[11px] text-slate-300/75">{subtitle}</p>
            )}
          </div>

          {showToolbar && (
            <div className="flex items-center gap-1.5">
              <IconButton
                title="Reset view"
                label="Reset"
                onClick={handleReset}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4"><path fill="currentColor" d="M12 6v3l4-4-4-4v3C6.48 4 2 8.48 2 14a8 8 0 0 0 13.86 5.14l-1.42-1.42A6 6 0 1 1 12 6z"/></svg>
              </IconButton>
              <IconButton
                title={legendVisible ? "Hide legend" : "Show legend"}
                label="Legend"
                onClick={handleToggleLegend}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4"><path fill="currentColor" d="M3 5h18v2H3V5zm0 6h12v2H3v-2zm0 6h18v2H3v-2z"/></svg>
              </IconButton>
              <IconButton
                title="Download PNG"
                label="PNG"
                onClick={handleDownload}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4"><path fill="currentColor" d="M5 20h14v-2H5v2zM11 4v7.17L8.41 8.59 7 10l5 5 5-5-1.41-1.41L13 11.17V4h-2z"/></svg>
              </IconButton>
              <IconButton
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                label="Full"
                onClick={handleFullscreen}
              >
                {isFullscreen ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4"><path fill="currentColor" d="M14 10V4h6v2h-4v4h-2zm-4 4v6H4v-2h4v-4h2zm0-10v6H4V8h4V4h2zm10 10v4h-4v2h6v-6h-2z"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4"><path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm0-4h3V7h2v5H7V10zm10 9h-3v2h5v-5h-2v3zm0-9V7h-3V5h5v5h-2z"/></svg>
                )}
              </IconButton>
            </div>
          )}
        </header>
      )}

      {/* Chart area */}
      <div className="relative px-3 pb-3 pt-2">
        {/* subtle ring on hover/focus */}
        <div className={`pointer-events-none absolute inset-0 rounded-2xl transition ${themeVars.ring}`} />

        {/* Loading */}
        {isLoading && !error && (
          <div
            className="absolute inset-3 animate-pulse rounded-xl bg-slate-800/40"
            style={{ height: height - 24 }}
          />
        )}

        {/* Error */}
        {error && (
          <div
            className="absolute inset-3 flex items-center justify-center rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-300"
            style={{ height: height - 24 }}
          >
            <span className="text-xs">Chart failed: {String(error)}</span>
          </div>
        )}

        {/* Plot container */}
        <div
          ref={containerRef}
          className="rounded-xl"
          style={{ height }}
          role={clickable ? "button" : "img"}
          aria-label={title ? `Plotly chart: ${title}` : "Plotly chart"}
          tabIndex={clickable ? 0 : undefined}
        />
      </div>
    </section>
  );
}

/**
 * Small accessible icon button used in the toolbar.
 */
function IconButton({ title, label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title || label}
      className={[
        "inline-flex items-center gap-1 rounded-lg border border-sky-400/20",
        "bg-slate-900/40 px-2 py-1 text-[10.5px] font-medium text-slate-200",
        "hover:bg-slate-900/60 hover:text-sky-200",
        "focus:outline-none focus:ring-2 focus:ring-sky-400/40",
        "transition",
      ].join(" ")}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
