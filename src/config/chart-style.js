export const chartStyle = Object.freeze({
  fontFamily: '"IBM Plex Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: 12,
  labelFontSize: 11,
  text: "var(--text)",
  softText: "var(--text-soft)",
  grid: "var(--border)",
  baseline: "var(--chart-baseline)",
  separator: "var(--page-bg)",
  neutral: "var(--chart-neutral)",
});

export function plotStyle(overrides = {}) {
  return {
    fontFamily: chartStyle.fontFamily,
    fontSize: chartStyle.fontSize,
    color: chartStyle.text,
    ...overrides,
  };
}

export function responsivePlotWidth(maxWidth, {cap = Infinity, min = 280} = {}) {
  const requested = Math.min(Number(maxWidth) || 790, cap);
  if (typeof window === "undefined") return requested;
  const viewport = Number(window.innerWidth) || requested;
  const gutter = viewport <= 720 ? 32 : 48;
  return Math.max(min, Math.min(requested, viewport - gutter));
}
