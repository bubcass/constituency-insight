import * as d3 from "../../_npm/d3@7.9.0/66d82917.js";
import {chartPalette} from "../config/chart-palette.7185253a.js";
import {waterfallSegmentsChart} from "./waterfall-segments-chart.5f399609.js";
import {percentageStripChart} from "./percentage-strip-chart.a5b42dda.js";

export function housingTenureWaterfall(
  data,
  {width = 790, title = "", subtitle = ""} = {},
) {
  const rows = (Array.isArray(data) ? data : [])
    .map((d) => ({tenure: String(d.tenure ?? ""), total: Number(d.total) || 0}))
    .filter((d) => d.tenure && d.total > 0)
    .sort((a, b) => d3.descending(a.total, b.total));
  const total = d3.sum(rows, (d) => d.total) || 1;
  let running = 0;
  const segments = rows.map((row, index) => {
    const x1 = running;
    const x2 = running + row.total;
    running = x2;
    return {
      Segment: row.tenure,
      value: row.total,
      share: row.total / total,
      x1,
      x2,
      color: chartPalette[index % chartPalette.length],
    };
  });

  const wrap = document.createElement("figure");
  wrap.className = "demographic-chart housing-chart";

  const heading = document.createElement("figcaption");
  heading.className = "demographic-chart__heading";
  heading.innerHTML = `<strong>${escapeHtml(title)}</strong>${
    subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""
  }`;
  wrap.appendChild(heading);
  wrap.appendChild(
    waterfallSegmentsChart(segments, {
      width,
      marginLeft: 290,
      minRowHeight: 36,
      minorShareThreshold: 0,
      xLabel: "Cumulative permanent private households",
      tickFormat: (value) => d3.format("~s")(value),
      valueFormat: (value) => d3.format(",")(value),
      ariaLabel: title || "Permanent private households by tenure",
    }),
  );

  return wrap;
}

export function housingStockBar(
  data,
  {width = 790, title = "", subtitle = "", vacancyRate = 0} = {},
) {
  const rows = (Array.isArray(data) ? data : [])
    .map((d, index) => ({
      category: String(d.category ?? ""),
      total: Math.max(0, Number(d.total) || 0),
      color: chartPalette[index % chartPalette.length],
    }))
    .filter((d) => d.category);
  return percentageStripChart(rows, {
    width,
    title,
    subtitle,
    className: "housing-chart housing-stock",
    itemLabel: "homes",
    shareLabel: "of housing stock",
    noteHtml: `Each stripe represents approximately 1% of housing stock. <strong>Vacancy rate: ${d3.format(".1f")(vacancyRate)}%</strong>`,
    ariaLabel: title || "Housing stock composition",
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
