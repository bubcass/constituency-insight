const LIGHT_CHART_TEXT = "#ffffff";
const DARK_CHART_TEXT = "#000000";

function channelToLinear(channel) {
  const value = channel / 255;
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

function colorChannels(color) {
  const value = String(color).trim();
  const hex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value);
  if (hex) return hex.slice(1).map((channel) => Number.parseInt(channel, 16));

  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(value);
  if (rgb) return rgb.slice(1).map(Number);

  return null;
}

function relativeLuminance(color) {
  const channels = colorChannels(color);
  if (!channels) return null;

  const [red, green, blue] = channels;
  return (
    0.2126 * channelToLinear(red) +
    0.7152 * channelToLinear(green) +
    0.0722 * channelToLinear(blue)
  );
}

function contrastRatio(first, second) {
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

export function contrastingChartText(background) {
  const backgroundLuminance = relativeLuminance(background);
  const lightLuminance = relativeLuminance(LIGHT_CHART_TEXT);
  const darkLuminance = relativeLuminance(DARK_CHART_TEXT);

  if (backgroundLuminance == null) return DARK_CHART_TEXT;

  return contrastRatio(backgroundLuminance, lightLuminance) >=
    contrastRatio(backgroundLuminance, darkLuminance)
    ? LIGHT_CHART_TEXT
    : DARK_CHART_TEXT;
}
