/**
 * src/components/dashboards/PlotlyMini.jsx
 * ------------------------------------------------------------
 * A lightweight, reusable Plotly thumbnail chart for dashboards
 * and project cards. Designed for your sci-fi portfolio aesthetic
 * (neon grid, holographic glow) and tiny footprints.
 *
 * Features
 * - Lazy-loads Plotly (cuts initial bundle size)
 * - Auto-resizes with ResizeObserver
 * - Optional sparkline mode (tight margins, no axes)
 * - Dark/“holographic” default styling that matches Tailwind dark UIs
 * - Clickable card surface (onClick) with accessible role
 * - Loading shimmer + graceful error state
 *
 * Props
 * - data:      Plotly traces (Array). Defaults to a simple line sparkline.
 * - layout:    Plotly layout overrides (Object).
 * - config:    Plotly config overrides (Object).
 * - title:     Tiny title text above the chart (String).
 * - footer:    Tiny footer/kpi text below the chart (String or Node).
 * - height:    Chart height in px (Number). Default: 180.
 * - interactive: If true, enables pan/zoom (Boolean). Default: false.
 * - sparkline: If true, hides axes/margins (Boolean). Default: true.
 * - className: Extra classes for the outer wrapper (String).
 * - onClick:   Click handler for the card (Function).
 *
 * Example (in an .astro file)
 * ---
 * import PlotlyMini from "../components/dashboards/PlotlyMini.jsx";
 * const traces = [{ x:[...], y:[...], mode:"lines" }];
 * ---
 * <PlotlyMini client:visible title="AAPL • Momentum" data={traces} />
 *
 * ------------------------------------------------------------
 */

import React from "react";

export default function PlotlyMini({
  data,
  layout,
  config,
  title,
  footer,
  height = 180,
  interactive = false,
  sparkline = true,
  className = "",
  onClick,
}) {
  const containerRef = React.useRef(null);
  const plotRef = React.useRef(null);     // Plotly instance
  const PlotlyRef = React.useRef(null);   // Module cache
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  // Default trace (simple sparkline) if none supplied
  const defaultData = React.useMemo(() => {
    const n = 30;
    const xs = Array.from({ length: n }, (_, i) => i + 1);
    // cute upward drift with noise
    const ys = xs.map((i) => 50 + i * 0.8 + (Math.sin(i * 0.7) * 4));
    return [
      {
        x: xs,
        y: ys,
        mode: "lines",
        line: { width: 2 },
        hoverinfo: "skip",
      },
    ];
  }, []);

  // Sci-fi / holographic default layout
  const baseLayout = React.useMemo(() => {
    const neon = "#60a5fa";     // Tailwind sky-400
    const grid = "rgba(96,165,250,0.15)";
    const font = "#cbd5e1";     // slate-300

    const sparkMargins = sparkline
      ? { l: 8, r: 8, t: 8, b: 8, pad: 0 }
      : { l: 32, r: 16, t: 24, b: 28, pad: 0 };

    return {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      margin: sparkMargins,
      height,
      font: { family: "ui-sans-serif, system-ui, Segoe UI, Roboto", color: font, size: 11 },
      xaxis: {
        showgrid: !sparkline,
        gridcolor: grid,
        zeroline: false,
        showline: false,
        ticks: "",
        showticklabels: !sparkline,
        tickfont: { size: 10 },
      },
      yaxis: {
        showgrid: !sparkline,
        gridcolor: grid,
        zeroline: false,
        showline: false,
        ticks: "",
        showticklabels: !sparkline,
        tickfont: { size: 10 },
      },
      shapes: [
        // faint top glow line
        {
          type: "line",
          x0: 0, x1: 1, xref: "paper",
          y0: 1, y1: 1, yref: "paper",
          line: { color: "rgba(96,165,250,0.25)", width: 1 },
        },
      ],
      // subtle hover style if interactive
      hoverlabel: {
        bgcolor: "rgba(2,6,23,0.85)", // slate-950-ish
        bordercolor: neon,
        font: { color: "#e5f2ff" },
      },
    };
  }, [height, sparkline]);

  const baseConfig = React.useMemo(() => {
    return {
      displayModeBar: false,
      responsive: true,
      staticPlot: !interactive,
      scrollZoom: interactive,
      doubleClick: interactive ? "reset+autosize" : false,
      // Maintain high-DPI sharpness
      toImageButtonOptions: { format: "png", filename: "mini-chart", scale: 2 },
    };
  }, [interactive]);

  // Lazy-load Plotly once
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!PlotlyRef.current) {
          // plotly.js-dist-min is the safest, DOM-ready bundle
          PlotlyRef.current = (await import("plotly.js-dist-min")).default;
        }
        if (!cancelled) setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load Plotly");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Render / re-render plot
  React.useEffect(() => {
    let destroyed = false;
    const doRender = async () => {
      if (!containerRef.current || !PlotlyRef.current) return;
      setIsLoading(true);

      const traces = (data && data.length ? data : defaultData).map((t) => ({
        hovertemplate: interactive ? (t.hovertemplate ?? "%{x}, %{y}<extra></extra>") : undefined,
        ...t,
      }));

      const mergedLayout = { ...baseLayout, ...(layout || {}) };
      const mergedConfig = { ...baseConfig, ...(config || {}) };

      try {
        // If a previous plot exists, react for fast updates
        if (plotRef.current) {
          await PlotlyRef.current.react(containerRef.current, traces, mergedLayout, mergedConfig);
        } else {
          await PlotlyRef.current.newPlot(containerRef.current, traces, mergedLayout, mergedConfig);
          plotRef.current = containerRef.current; // mark as plotted
        }
        if (!destroyed) setIsLoading(false);
      } catch (e) {
        if (!destroyed) {
          setError(e instanceof Error ? e.message : "Failed to render chart");
          setIsLoading(false);
        }
      }
    };

    doRender();
    return () => {
      destroyed = true;
    };
  }, [data, layout, config, defaultData, baseLayout, baseConfig, interactive]);

  // ResizeObserver for responsive thumbs
  React.useEffect(() => {
    if (!containerRef.current || !PlotlyRef.current) return;
    const ro = new ResizeObserver(() => {
      if (PlotlyRef.current && plotRef.current) {
        PlotlyRef.current.Plots.resize(containerRef.current);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (PlotlyRef.current && plotRef.current) {
        try {
          PlotlyRef.current.purge(plotRef.current);
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  const clickable = typeof onClick === "function";

  return (
    <div
      className={[
        "group relative overflow-hidden rounded-2xl border border-slate-800/60 bg-gradient-to-b from-slate-950/60 to-slate-900/40",
        "shadow-[0_0_20px_-6px_rgba(56,189,248,0.25)] backdrop-blur",
        clickable ? "cursor-pointer hover:shadow-[0_0_35px_-6px_rgba(56,189,248,0.45)]" : "",
        "transition-shadow duration-300",
        className,
      ].join(" ")}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={title ? `Chart: ${title}` : "Chart thumbnail"}
    >
      {title && (
        <div className="px-3 pt-2 text-[11px] uppercase tracking-wide text-sky-300/80">
          {title}
        </div>
      )}

      <div className="relative px-2 pt-1">
        {/* Glow border on hover */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-sky-400/10 group-hover:ring-sky-300/25 transition-colors" />

        {/* Loading shimmer */}
        {isLoading && !error && (
          <div
            className="absolute inset-2 animate-pulse rounded-xl bg-slate-800/40"
            style={{ height: height - 16 }}
          />
        )}

        {/* Error state */}
        {error && (
          <div
            className="absolute inset-2 flex items-center justify-center rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-300"
            style={{ height: height - 16 }}
          >
            <span className="text-xs">Chart failed: {String(error)}</span>
          </div>
        )}

        {/* Plot container */}
        <div
          ref={containerRef}
          className="rounded-xl"
          style={{ height }}
        />
      </div>

      {footer && (
        <div className="px-3 pb-2 pt-1 text-[11px] text-slate-300/80">
          {footer}
        </div>
      )}
    </div>
  );
}
