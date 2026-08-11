import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";
import {chartStyle, plotStyle} from "../config/chart-style.js";
import {contrastingChartText} from "../config/chart-contrast.js";

export function waterfallSegmentsChart(
  segments,
  {
    width = 1000,
    title = null,
    caption = null,
    fontFamily = chartStyle.fontFamily,
    marginLeft = 120,
    minRowHeight = 32,
    minorShareThreshold = 0.01,
    xLabel = "Funding (€ millions)",
    tickFormat = null,
    valueFormat = null,
    shareFormat = null,
    ariaLabel = null,
  } = {},
) {
  const safeSegments = Array.isArray(segments) ? segments : [];

  const majorSegments = safeSegments.filter(
    (d) => (Number(d.share) || 0) >= minorShareThreshold,
  );

  const minorSegments = safeSegments.filter(
    (d) => (Number(d.share) || 0) < minorShareThreshold,
  );

  const rowCount = Math.max(majorSegments.length, 1);
  const height = Math.max(220, rowCount * minRowHeight + 90);

  const maxValue = d3.max(safeSegments, (d) => d.x2) ?? 1;
  const marginRight = 30;

  const wrap = document.createElement("div");
  wrap.className = "waterfall-segments-chart-wrap";

  const scrollHint = document.createElement("p");
  scrollHint.className = "waterfall-segments-chart__scroll-hint";
  scrollHint.textContent = "Scroll horizontally to explore →";

  const scrollRegion = document.createElement("div");
  scrollRegion.className = "waterfall-segments-chart__scroll";
  scrollRegion.setAttribute("role", "region");
  scrollRegion.setAttribute("aria-label", "Scrollable waterfall chart");
  scrollRegion.tabIndex = 0;

  function formatMillionsTick(value) {
    return `€${d3.format("~g")(Number(value || 0) / 1_000_000)}m`;
  }

  function formatMillionsLabel(value) {
    return `€${(Number(value || 0) / 1_000_000).toFixed(2)}m`;
  }

  const resolvedTickFormat = typeof tickFormat === "function"
    ? tickFormat
    : formatMillionsTick;
  const resolvedValueFormat = typeof valueFormat === "function"
    ? valueFormat
    : formatMillionsLabel;
  const resolvedShareFormat = typeof shareFormat === "function"
    ? shareFormat
    : d3.format(".1%");

  function segmentLabel(d) {
    return `${resolvedValueFormat(d.value)} (${resolvedShareFormat(d.share)})`;
  }

  function labelFitsInside(d) {
    const plotWidth = Math.max(1, width - marginLeft - marginRight);
    const segmentWidth = Math.max(0, Number(d.x2) - Number(d.x1));
    const segmentWidthPx = (segmentWidth / maxValue) * plotWidth;
    const labelWidthPx = Array.from(segmentLabel(d)).length * chartStyle.labelFontSize * 0.62;
    const horizontalPaddingPx = 22;

    return segmentWidthPx >= labelWidthPx + horizontalPaddingPx;
  }

  function sanitizePlotAccessibility(root) {
    if (!root) return;

    const svg = root.matches?.("svg") ? root : root.querySelector("svg");
    if (!svg) return;

    svg.setAttribute("role", "img");

    if (ariaLabel) {
      svg.setAttribute("aria-label", ariaLabel);
    } else if (title || caption) {
      const label = [title, caption].filter(Boolean).join(". ");
      if (label) svg.setAttribute("aria-label", label);
    } else {
      svg.setAttribute("aria-label", "Funding by sport type waterfall chart");
    }

    const invalidLabelledGroups = svg.querySelectorAll("g[aria-label]");
    invalidLabelledGroups.forEach((el) => {
      const role = el.getAttribute("role");
      if (!role) {
        el.removeAttribute("aria-label");
      }
    });
  }

  const chart = Plot.plot({
    width,
    height,
    marginLeft,
    marginRight,
    marginTop: 50,
    marginBottom: 28,
    grid: true,
    title,
    caption,
    style: {
      ...plotStyle(),
      fontFamily,
    },
    x: {
      label: xLabel,
      axis: "top",
      grid: true,
      tickFormat: (d) => resolvedTickFormat(d),
      domain: [0, maxValue],
    },
    y: {
      domain: majorSegments.map((d) => d.Segment),
      label: null,
      tickPadding: 6,
      tickSize: 0,
      padding: 0.35,
    },
    marks: [
      Plot.barX(majorSegments, {
        x1: "x1",
        x2: "x2",
        y: "Segment",
        fill: "color",
        stroke: chartStyle.separator,
        strokeWidth: 0.5,
        rx: 3,
        ariaHidden: true,
      }),

      Plot.ruleX(
        majorSegments.filter((d) => !labelFitsInside(d)),
        {
          x: "x1",
          x2: (d) => Math.max(0, d.x1 - maxValue * 0.012),
          y: "Segment",
          stroke: chartStyle.softText,
          ariaHidden: true,
        },
      ),

      Plot.text(majorSegments, {
        x: (d) => {
          return !labelFitsInside(d)
            ? Math.max(0, d.x1 - maxValue * 0.055)
            : (d.x1 + d.x2) / 2;
        },
        y: "Segment",
        text: segmentLabel,
        textAnchor: (d) => labelFitsInside(d) ? "middle" : "end",
        fill: (d) => labelFitsInside(d)
          ? contrastingChartText(d.color)
          : chartStyle.text,
        dx: 0,
        dy: 0,
        lineAnchor: "middle",
        fontSize: chartStyle.labelFontSize,
        fontWeight: 600,
        ariaHidden: true,
      }),
    ],
  });

  sanitizePlotAccessibility(chart);
  scrollRegion.appendChild(chart);
  wrap.append(scrollHint, scrollRegion);

  if (minorSegments.length) {
    const names = minorSegments.map((d) => d.Segment);

    let summaryText = "";
    if (names.length === 1) {
      summaryText = `${names[0]} also received funding totalling less than 1% of the total.`;
    } else if (names.length === 2) {
      summaryText = `${names[0]} and ${names[1]} also received funding totalling less than 1% of the total.`;
    } else {
      summaryText = `${names.slice(0, -1).join(", ")}, and ${
        names[names.length - 1]
      } also received funding totalling less than 1% of the total.`;
    }

    const note = document.createElement("p");
    note.className = "waterfall-segments-chart__note";
    note.textContent = summaryText;

    wrap.appendChild(note);
  }

  return wrap;
}
