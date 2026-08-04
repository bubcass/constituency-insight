import * as d3 from "npm:d3";
import * as Plot from "npm:@observablehq/plot";
import {chartPalette} from "../config/chart-palette.js";
import {chartStyle, plotStyle} from "../config/chart-style.js";

export function lollipopChart(data, {
  width = 790,
  title = "",
  subtitle = "",
  category = "category",
  value = "value",
  color = null,
  xLabel = null,
  valueFormat = d3.format(","),
  tickFormat = d3.format("~s"),
  domain = null,
  marginLeft = 210,
  ariaLabel = title || "Lollipop chart",
} = {}) {
  const rows = (Array.isArray(data) ? data : [])
    .map((row, index) => ({
      source: row,
      category: String(accessorValue(row, category) ?? ""),
      value: Math.max(0, Number(accessorValue(row, value)) || 0),
      color: color ? accessorValue(row, color) : chartPalette[index % chartPalette.length],
    }))
    .filter((row) => row.category);
  const maxValue = d3.max(rows, (row) => row.value) || 1;
  const xDomain = domain ?? [0, maxValue * 1.15];
  const plotWidth = Math.max(620, Math.min(Number(width) || 790, 790));

  const figure = document.createElement("figure");
  figure.className = "demographic-chart lollipop-chart";
  const heading = document.createElement("figcaption");
  heading.className = "demographic-chart__heading";
  heading.innerHTML = `<strong>${escapeHtml(title)}</strong>${
    subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""
  }`;
  figure.appendChild(heading);

  const plot = Plot.plot({
    width: plotWidth,
    height: Math.max(190, rows.length * 38 + 85),
    marginTop: 18,
    marginRight: 80,
    marginBottom: 45,
    marginLeft,
    style: plotStyle(),
    x: {domain: xDomain, grid: true, label: xLabel, tickFormat},
    y: {
      domain: rows.map((row) => row.category),
      label: null,
      tickSize: 0,
      padding: 0.5,
    },
    marks: [
      Plot.ruleX([0], {stroke: chartStyle.baseline}),
      Plot.ruleY(rows, {
        y: "category",
        x1: 0,
        x2: "value",
        stroke: "color",
        strokeWidth: 2,
      }),
      Plot.dot(rows, {
        x: "value",
        y: "category",
        fill: "color",
        r: 6,
        title: (row) => `${row.category}: ${valueFormat(row.value, row.source)}`,
      }),
      Plot.text(rows, {
        x: "value",
        y: "category",
        text: (row) => valueFormat(row.value, row.source),
        dx: 12,
        textAnchor: "start",
        fill: chartStyle.text,
        fontSize: chartStyle.labelFontSize,
      }),
    ],
  });
  plot.setAttribute("role", "img");
  plot.setAttribute("aria-label", ariaLabel);

  const shell = document.createElement("div");
  shell.className = "demographic-chart__plot demographic-chart__plot--scroll";
  shell.appendChild(plot);
  figure.appendChild(shell);
  return figure;
}

function accessorValue(row, accessor) {
  return typeof accessor === "function" ? accessor(row) : row?.[accessor];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
