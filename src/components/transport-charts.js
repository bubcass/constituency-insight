import * as d3 from "npm:d3";
import {chartColors, chartPalette} from "../config/chart-palette.js";
import {waterfallSegmentsChart} from "./waterfall-segments-chart.js";
import {percentageStripChart} from "./percentage-strip-chart.js";

export function transportMeansWaterfall(
  data,
  {width = 790, title = "", subtitle = ""} = {},
) {
  const rows = (Array.isArray(data) ? data : [])
    .map((row) => ({label: String(row.label ?? ""), total: Math.max(0, Number(row.total) || 0)}))
    .filter((row) => row.label && row.total > 0)
    .sort((a, b) => d3.descending(a.total, b.total) || d3.ascending(a.label, b.label));
  const total = d3.sum(rows, (row) => row.total) || 1;
  let running = 0;
  const segments = rows.map((row, index) => {
    const x1 = running;
    const x2 = running + row.total;
    running = x2;
    return {
      Segment: row.label,
      value: row.total,
      share: row.total / total,
      x1,
      x2,
      color: chartPalette[index % chartPalette.length]
    };
  });

  const wrap = chartFrame(title, subtitle, "transport-means-chart");
  wrap.appendChild(waterfallSegmentsChart(segments, {
    width,
    marginLeft: 215,
    minRowHeight: 36,
    minorShareThreshold: 0,
    xLabel: "Cumulative people with a stated means of travel",
    tickFormat: (value) => d3.format("~s")(value),
    valueFormat: (value) => d3.format(",")(value),
    ariaLabel: title || "Usual means of travel"
  }));
  return wrap;
}

export function commuteTimingStrip(
  data,
  {
    title = "",
    subtitle = "",
    notStated = 0,
    ariaLabel = "Travel timing distribution"
  } = {},
) {
  const rows = (Array.isArray(data) ? data : [])
    .map((row) => ({
      category: String(row.shortLabel ?? row.label ?? ""),
      fullLabel: String(row.label ?? row.shortLabel ?? ""),
      total: Math.max(0, Number(row.total) || 0)
    }))
    .filter((row) => row.category);
  const total = d3.sum(rows, (row) => row.total) || 1;
  const maximumShare = d3.max(rows, (row) => row.total / total) || 0.01;
  const hotBlue = d3.color(chartColors.blue).darker(0.45).formatHex();
  const color = d3.scaleSequential(d3.interpolateLab("#e6edf1", hotBlue))
    .domain([0, maximumShare]);
  const largest = rows.reduce((best, row) => !best || row.total > best.total ? row : best, null);
  const largestShare = largest ? largest.total / total : 0;
  const note = [
    `Each stripe represents approximately 1% of stated responses.`,
    largest ? `<strong>Largest group: ${escapeHtml(largest.fullLabel)} · ${d3.format(".1%")(largestShare)}.</strong>` : "",
    notStated ? `Not stated: ${d3.format(",")(notStated)}.` : ""
  ].filter(Boolean).join(" ");

  return percentageStripChart(rows.map((row) => ({
    category: row.category,
    total: row.total,
    color: color(row.total / total)
  })), {
    title,
    subtitle,
    className: "transport-timing-strip",
    itemLabel: "people",
    shareLabel: "of stated responses",
    noteHtml: note,
    ariaLabel
  });
}

function chartFrame(title, subtitle, className) {
  const wrap = document.createElement("figure");
  wrap.className = `demographic-chart transport-chart ${className}`;
  const heading = document.createElement("figcaption");
  heading.className = "demographic-chart__heading";
  heading.innerHTML = `<strong>${escapeHtml(title)}</strong>${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""}`;
  wrap.appendChild(heading);
  return wrap;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
