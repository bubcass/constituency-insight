import * as d3 from "npm:d3";
import {chartColors, chartPalette} from "../config/chart-palette.js";
import {contrastingChartText} from "../config/chart-contrast.js";
import {waterfallSegmentsChart} from "./waterfall-segments-chart.js";

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

export function commuteTimingHeatmap(
  data,
  {
    title = "",
    subtitle = "",
    notStated = 0,
    markers = [],
    ariaLabel = "Travel timing distribution"
  } = {},
) {
  const rows = (Array.isArray(data) ? data : [])
    .map((row) => ({
      category: String(row.shortLabel ?? row.label ?? ""),
      fullLabel: String(row.label ?? row.shortLabel ?? ""),
      code: String(row.code ?? ""),
      total: Math.max(0, Number(row.total) || 0)
    }))
    .filter((row) => row.category);
  const total = d3.sum(rows, (row) => row.total) || 1;
  const maximumCount = d3.max(rows, (row) => row.total) || 1;
  const hotBlue = d3.color(chartColors.blue).darker(0.45).formatHex();
  const color = d3.scaleSequential(d3.interpolateLab("#e6edf1", hotBlue))
    .domain([0, maximumCount]);
  const largest = rows.reduce((best, row) => !best || row.total > best.total ? row : best, null);
  const largestShare = largest ? largest.total / total : 0;
  const note = [
    `Each equal-width cell represents one published time band; darker blue indicates more people in that band.`,
    largest ? `<strong>Largest group: ${escapeHtml(largest.fullLabel)} · ${d3.format(".1%")(largestShare)}.</strong>` : "",
    notStated ? `Not stated: ${d3.format(",")(notStated)}.` : ""
  ].filter(Boolean).join(" ");

  const wrap = chartFrame(title, subtitle, "transport-timing-heatmap");
  const legend = document.createElement("div");
  legend.className = "percentage-strip__legend transport-timing-heatmap__legend";
  const grid = document.createElement("div");
  grid.className = "transport-timing-heatmap__grid";
  grid.style.setProperty("--timing-columns", String(Math.max(1, rows.length)));
  grid.setAttribute("role", "group");
  grid.setAttribute("aria-label", `${ariaLabel}. ${rows.map((row) => `${row.fullLabel}: ${d3.format(".1%")(row.total / total)}`).join("; ")}.`);

  for (const row of rows) {
    const share = row.total / total;
    const fill = color(row.total);
    const legendItem = document.createElement("div");
    legendItem.className = "percentage-strip__legend-item";
    legendItem.innerHTML = `
      <span class="percentage-strip__swatch" style="--percentage-strip-color:${fill}" aria-hidden="true"></span>
      <span class="percentage-strip__legend-copy">
        <strong>${escapeHtml(row.category)}</strong>
        <span>${d3.format(".1%")(share)} · ${d3.format(",")(row.total)}</span>
      </span>
    `;
    legend.appendChild(legendItem);

    const cell = document.createElement("div");
    cell.className = "transport-timing-heatmap__cell";
    cell.style.backgroundColor = fill;
    cell.style.color = contrastingChartText(fill);
    cell.tabIndex = 0;
    cell.title = `${row.fullLabel}: ${d3.format(",")(row.total)} people (${d3.format(".1%")(share)})`;
    cell.setAttribute("aria-label", cell.title);
    cell.innerHTML = `<strong>${d3.format(".1%")(share)}</strong>`;
    grid.appendChild(cell);
  }

  const noteElement = document.createElement("p");
  noteElement.className = "percentage-strip__note transport-timing-heatmap__note";
  noteElement.innerHTML = note;
  wrap.append(legend, grid);
  const markerRail = timingMarkerRail(rows, markers);
  if (markerRail) wrap.appendChild(markerRail);
  wrap.appendChild(noteElement);
  return wrap;
}

function timingMarkerRail(rows, markers) {
  const labels = new Map(
    (Array.isArray(markers) ? markers : []).map((marker) => [String(marker.afterCode), marker.label])
  );
  if (!labels.size) return null;

  const wrap = document.createElement("div");
  wrap.className = "transport-timing-markers";
  wrap.setAttribute("aria-hidden", "true");
  const rail = document.createElement("div");
  rail.className = "transport-timing-markers__rail";
  const markerEntries = [];
  rows.forEach((row, index) => {
    const label = labels.get(row.code);
    if (label) markerEntries.push({label, position: ((index + 1) / rows.length) * 100});
  });

  const trackEnds = [];
  for (const entry of markerEntries) {
    let track = trackEnds.findIndex((lastPosition) => entry.position - lastPosition >= 11);
    if (track < 0) track = trackEnds.length;
    trackEnds[track] = entry.position;
    const marker = document.createElement("span");
    marker.className = "transport-timing-markers__marker";
    marker.style.left = `${entry.position}%`;
    marker.style.setProperty("--marker-track", String(track));
    marker.innerHTML = `<i></i><b>${escapeHtml(entry.label)}</b>`;
    rail.appendChild(marker);
  }
  rail.style.setProperty("--marker-tracks", String(Math.max(0, trackEnds.length - 1)));
  wrap.appendChild(rail);
  return wrap;
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
