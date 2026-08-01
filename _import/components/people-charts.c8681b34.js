import * as d3 from "../../_npm/d3@7.9.0/66d82917.js";
import * as Plot from "../../_npm/@observablehq/plot@0.6.17/a96a6bbb.js";
import {chartPalette} from "../config/chart-palette.dbce5681.js";
import {chartStyle, plotStyle, responsivePlotWidth} from "../config/chart-style.e62386e1.js";
import {waterfallSegmentsChart} from "./waterfall-segments-chart.12242099.js";

export function principalEconomicStatusWaterfall(
  data,
  {width = 960, title = "", subtitle = ""} = {},
) {
  const rows = (Array.isArray(data) ? data : [])
    .map((d) => ({
      economicStatus: String(d.economicStatus ?? ""),
      total: Math.max(0, Number(d.total) || 0),
    }))
    .filter((d) => d.economicStatus && d.total > 0)
    .sort(
      (a, b) =>
        d3.descending(a.total, b.total) ||
        d3.ascending(a.economicStatus, b.economicStatus),
    );
  const total = d3.sum(rows, (d) => d.total) || 1;
  let running = 0;
  const segments = rows.map((row, index) => {
    const x1 = running;
    const x2 = running + row.total;
    running = x2;
    return {
      Segment: row.economicStatus,
      value: row.total,
      share: row.total / total,
      x1,
      x2,
      color: chartPalette[index % chartPalette.length],
    };
  });

  const wrap = document.createElement("figure");
  wrap.className = "demographic-chart people-chart";
  const heading = document.createElement("figcaption");
  heading.className = "demographic-chart__heading";
  heading.innerHTML = `<strong>${escapeHtml(title)}</strong>${
    subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""
  }`;
  wrap.appendChild(heading);
  wrap.appendChild(
    waterfallSegmentsChart(segments, {
      width,
      marginLeft: 315,
      minRowHeight: 36,
      minorShareThreshold: 0,
      xLabel: "Cumulative population",
      tickFormat: (value) => d3.format("~s")(value),
      valueFormat: (value) => d3.format(",")(value),
      ariaLabel: title || "Population by principal economic status",
    }),
  );
  return wrap;
}

export function irishSpeakerShareWaffle(
  {speakers = 0, population = 0} = {},
  {width = 790, title = "", subtitle = ""} = {},
) {
  const safePopulation = Math.max(0, Number(population) || 0);
  const safeSpeakers = Math.min(safePopulation, Math.max(0, Number(speakers) || 0));
  const share = safePopulation > 0 ? safeSpeakers / safePopulation : 0;
  const activeCells = Math.round(share * 100);
  const cells = d3.range(100).map((index) => ({
    index,
    column: index % 20,
    row: Math.floor(index / 20),
    active: index < activeCells,
  }));
  const rest = Math.max(0, safePopulation - safeSpeakers);
  const highlight = chartPalette[0];
  const remainder = chartStyle.neutral;
  const plotWidth = responsivePlotWidth(width, {cap: 650});
  const dotRadius = Math.max(5.5, Math.min(13, plotWidth / 50));

  const wrap = document.createElement("figure");
  wrap.className = "demographic-chart irish-speaker-share";
  const heading = document.createElement("figcaption");
  heading.className = "demographic-chart__heading";
  heading.innerHTML = `<strong>${escapeHtml(title)}</strong>${
    subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""
  }`;

  const summary = document.createElement("div");
  summary.className = "irish-speaker-share__summary";
  summary.innerHTML = `
    <strong>${d3.format(".1%")(share)}</strong>
    <span>${d3.format(",")(safeSpeakers)} Irish speakers out of ${d3.format(",")(safePopulation)} residents</span>
  `;

  const plot = Plot.plot({
    width: plotWidth,
    height: Math.max(96, Math.round(plotWidth * 175 / 650)),
    margin: 8,
    axis: null,
    style: plotStyle(),
    x: {domain: [-0.7, 19.3]},
    y: {domain: [4.3, -0.7]},
    marks: [
      Plot.dot(cells, {
        x: "column",
        y: "row",
        r: dotRadius,
        fill: (d) => d.active ? highlight : remainder,
        fillOpacity: (d) => d.active ? 1 : 0.68,
        stroke: chartStyle.separator,
        strokeWidth: 1.5,
        title: (d) => d.active
          ? `${d3.format(",")(safeSpeakers)} Irish speakers (${d3.format(".1%")(share)} of the total population)`
          : `${d3.format(",")(rest)} other residents (${d3.format(".1%")(1 - share)} of the total population)`,
      }),
    ],
  });
  plot.setAttribute("role", "img");
  plot.setAttribute(
    "aria-label",
    `${d3.format(".1%")(share)} of the total population are Irish speakers aged three and over.`,
  );

  const plotWrap = document.createElement("div");
  plotWrap.className = "irish-speaker-share__plot";
  plotWrap.appendChild(plot);

  const legend = document.createElement("div");
  legend.className = "irish-speaker-share__legend";
  legend.innerHTML = `
    <span><i style="--irish-share-color:${highlight}" aria-hidden="true"></i>Irish speakers</span>
    <span><i style="--irish-share-color:${remainder}" aria-hidden="true"></i>Rest of population</span>
  `;

  const note = document.createElement("p");
  note.className = "irish-speaker-share__note";
  note.textContent = "Each dot represents approximately 1% of the total population in the selected area.";

  wrap.append(heading, summary, plotWrap, legend, note);
  return wrap;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
