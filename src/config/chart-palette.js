const freezePalette = (colors) => Object.freeze([...colors]);

export const chartPalettes = Object.freeze({
  default: freezePalette([
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
    "#bcbd22",
    "#17becf",
  ]),
  muted: freezePalette([
    "#2678a8",
    "#d47a2f",
    "#2f8b68",
    "#b84d45",
    "#755894",
    "#8a654a",
    "#ad668f",
    "#777777",
    "#9b8738",
    "#3b8991",
  ]),
  lrs: freezePalette([
    "#2c3b72",
    "#e0c879",
    "#5ea03b",
    "#32bcea",
    "#6b70a6",
    "#00aaac",
    "#ef4569",
  ]),
  pbo: freezePalette([
    "#6b1448",
    "#893866",
    "#e5c9d6",
    "#ffbb00",
    "#0ecaca",
    "#008080",
    "#ff6f61",
    "#b25e84",
    "#c8960c",
  ]),
});

// Change value to apply a palette to categorical charts site-wide.
export const chartPaletteName = "default";

export function getChartPalette(name = chartPaletteName) {
  const palette = chartPalettes[name];
  if (!palette) {
    throw new RangeError(
      `Unknown chart palette "${name}". Choose one of: ${Object.keys(chartPalettes).join(", ")}.`,
    );
  }
  return palette;
}

export function resolveChartPalette(palette = chartPaletteName) {
  if (Array.isArray(palette) && palette.length) return palette;
  return getChartPalette(palette);
}

export function categoryColorMap(categories, palette = chartPaletteName) {
  const colors = resolveChartPalette(palette);
  return Object.fromEntries(
    categories.map((category, index) => [category, colors[index % colors.length]]),
  );
}

// Backwards-compatible active-palette export used throughout the chart components.
export const chartPalette = getChartPalette();

const namedColors = Object.freeze({
  default: Object.freeze({
    blue: "#1f77b4",
    orange: "#ff7f0e",
    green: "#2ca02c",
    red: "#d62728",
    purple: "#9467bd",
    brown: "#8c564b",
    pink: "#e377c2",
    grey: "#7f7f7f",
    olive: "#bcbd22",
    cyan: "#17becf",
  }),
  muted: Object.freeze({
    blue: "#2678a8",
    orange: "#d47a2f",
    green: "#2f8b68",
    red: "#b84d45",
    purple: "#755894",
    brown: "#8a654a",
    pink: "#ad668f",
    grey: "#777777",
    olive: "#9b8738",
    cyan: "#3b8991",
  }),
  lrs: Object.freeze({
    blue: "#2c3b72",
    orange: "#e0c879",
    green: "#5ea03b",
    red: "#ef4569",
    purple: "#6b70a6",
    brown: "#00aaac",
    pink: "#ef4569",
    grey: "#777777",
    olive: "#e0c879",
    cyan: "#32bcea",
  }),
  pbo: Object.freeze({
    blue: "#008080",
    orange: "#ffbb00",
    green: "#0ecaca",
    red: "#ff6f61",
    purple: "#6b1448",
    brown: "#893866",
    pink: "#b25e84",
    grey: "#777777",
    olive: "#c8960c",
    cyan: "#0ecaca",
  }),
});

export const chartColors = namedColors[chartPaletteName];
