import * as d3 from "../../_npm/d3@7.9.0/66d82917.js";
import * as Plot from "../../_npm/@observablehq/plot@0.6.17/a96a6bbb.js";
import { chartPalette } from "../config/chart-palette.7185253a.js";
import {chartStyle, plotStyle, responsivePlotWidth} from "../config/chart-style.ae393eab.js";
import {sanitizePlotAccessibility} from "./plot-accessibility.36b70e98.js";

const WAFFLE_COLUMNS = 20;
const WAFFLE_ROWS = 5;

export function employmentWaffle(data, {
  width = 790,
  title = "",
  subtitle = "",
  populationLabel = "people",
  populationContext = "people at work",
  note = "Each dot represents 1% of people at work in the selected area.",
  ariaLabel = "Industry profile waffle chart",
  sort = true,
} = {}) {
  const wrap = chartFrame(title, subtitle);
  const rows = normaliseRows(data, {sort});
  const total = d3.sum(rows, (d) => d.total) || 1;
  const colors = colorLookup(rows);
  const dots = allocateDots(rows, total);
  const plotWidth = responsivePlotWidth(width, {cap: 650});
  const dotRadius = Math.max(5.5, Math.min(13, plotWidth / 50));

  const shell = document.createElement("div");
  shell.className = "employment-waffle";

  const plot = Plot.plot({
    width: plotWidth,
    height: Math.max(96, Math.round(plotWidth * 175 / 650)),
    margin: 8,
    axis: null,
    style: plotStyle(),
    x: { domain: [-0.7, WAFFLE_COLUMNS - 0.3] },
    y: { domain: [WAFFLE_ROWS - 0.3, -0.7] },
    color: {
      domain: rows.map((d) => d.sector),
      range: rows.map((d) => colors.get(d.sector)),
      legend: false,
    },
    marks: [
      Plot.dot(dots, {
        x: "column",
        y: "row",
        fill: "sector",
        r: dotRadius,
        stroke: chartStyle.separator,
        strokeWidth: 1.5,
        ariaHidden: true,
        title: (d) => `${d.sector}: ${d3.format(",")(d.total)} ${populationLabel} (${d3.format(".1%")(d.share)} of ${populationContext})`,
      }),
    ],
  });
  plot.setAttribute("role", "img");
  plot.setAttribute("aria-label", title || ariaLabel);
  sanitizePlotAccessibility(plot);

  const legend = document.createElement("div");
  legend.className = "employment-waffle__legend";

  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "employment-waffle__legend-item";
    item.innerHTML = `
      <span class="employment-waffle__swatch" style="--employment-color:${colors.get(row.sector)}" aria-hidden="true"></span>
      <span class="employment-waffle__legend-copy">
        <strong>${escapeHtml(row.sector)}</strong>
        <span>${d3.format(".1%")(row.total / total)} · ${d3.format(",")(row.total)}</span>
      </span>
    `;
    legend.appendChild(item);
  }

  const plotWrap = document.createElement("div");
  plotWrap.className = "employment-waffle__plot";

  const noteElement = document.createElement("p");
  noteElement.className = "employment-waffle__note";
  noteElement.textContent = note;
  plotWrap.append(plot, noteElement);

  shell.append(legend, plotWrap);
  wrap.appendChild(shell);
  return wrap;
}

export function employmentLollipop(data, {
  width = 790,
  title = "",
  subtitle = "",
} = {}) {
  const wrap = chartFrame(title, subtitle);
  const rows = normaliseRows(data).slice().sort((a, b) => d3.descending(a.total, b.total));
  const total = d3.sum(rows, (d) => d.total) || 1;
  const colors = colorLookup(rows);
  const maxValue = d3.max(rows, (d) => d.total) || 1;
  const height = Math.max(390, rows.length * 39 + 80);
  const plotWidth = Math.max(620, Math.min(Number(width) || 790, 790));

  const chart = Plot.plot({
    width: plotWidth,
    height,
    marginTop: 24,
    marginRight: 86,
    marginBottom: 42,
    marginLeft: 230,
    style: plotStyle(),
    x: {
      domain: [0, maxValue * 1.13],
      grid: true,
      label: "People",
      tickFormat: d3.format("~s"),
    },
    y: {
      domain: rows.map((d) => d.sector),
      label: null,
      tickSize: 0,
      padding: 0.42,
    },
    marks: [
      Plot.ruleX([0], { stroke: chartStyle.baseline }),
      Plot.ruleY(rows, {
        y: "sector",
        x1: 0,
        x2: "total",
        stroke: (d) => colors.get(d.sector),
        strokeWidth: 2,
      }),
      Plot.dot(rows, {
        x: "total",
        y: "sector",
        fill: (d) => colors.get(d.sector),
        r: 6,
      }),
      Plot.text(rows, {
        x: "total",
        y: "sector",
        text: (d) => d3.format(",")(d.total),
        dx: 12,
        textAnchor: "start",
        fill: chartStyle.text,
        fontSize: chartStyle.labelFontSize,
      }),
      Plot.rectX(rows, {
        className: "employment-chart__hit-target",
        x1: 0,
        x2: maxValue * 1.13,
        y: "sector",
        fill: "transparent",
        insetTop: -5,
        insetBottom: -5,
      }),
    ],
  });
  chart.setAttribute("role", "img");
  chart.setAttribute("aria-label", title || "Employment groups lollipop chart");

  wrap.appendChild(withTooltip(chart, rows, (d) => `
    <strong>${escapeHtml(d.sector)}</strong>
    <span>${d3.format(",")(d.total)} people</span>
    <span>${d3.format(".1%")(d.total / total)} of people at work in the selected area</span>
  `));
  return wrap;
}

function chartFrame(title, subtitle) {
  const wrap = document.createElement("figure");
  wrap.className = "demographic-chart employment-chart";

  const heading = document.createElement("figcaption");
  heading.className = "demographic-chart__heading";
  heading.innerHTML = `<strong>${escapeHtml(title)}</strong>${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""}`;
  wrap.appendChild(heading);
  return wrap;
}

function withTooltip(chart, rows, tooltipHTML) {
  const shell = document.createElement("div");
  shell.className = "demographic-chart__plot demographic-chart__plot--scroll";
  const tooltip = document.createElement("div");
  tooltip.className = "demographic-chart__tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.style.opacity = "0";
  shell.append(chart, tooltip);

  const targets = Array.from(
    chart.querySelectorAll(".employment-chart__hit-target rect"),
  );
  targets.forEach((target, index) => {
    const row = rows[index];
    if (!row) return;
    target.setAttribute("tabindex", "0");

    const show = (event) => {
      tooltip.innerHTML = tooltipHTML(row);
      tooltip.style.opacity = "1";
      const shellRect = shell.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const left = Math.min(
        Math.max(targetRect.right - shellRect.left + 10, 8),
        Math.max(8, shellRect.width - tooltip.offsetWidth - 8),
      );
      const top = Math.min(
        Math.max((event?.clientY || targetRect.top) - shellRect.top - tooltip.offsetHeight / 2, 8),
        Math.max(8, shellRect.height - tooltip.offsetHeight - 8),
      );
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    };
    const hide = () => { tooltip.style.opacity = "0"; };

    target.addEventListener("pointerenter", show);
    target.addEventListener("pointermove", show);
    target.addEventListener("pointerleave", hide);
    target.addEventListener("focus", show);
    target.addEventListener("blur", hide);
  });

  return shell;
}

function normaliseRows(data, {sort = true} = {}) {
  const rows = (Array.isArray(data) ? data : [])
    .map((d) => ({
      sector: String(d.sector ?? ""),
      total: Number(d.total) || 0,
      color: d.color ? String(d.color) : null,
    }))
    .filter((d) => d.sector && d.total > 0);
  return sort ? rows.sort((a, b) => d3.descending(a.total, b.total)) : rows;
}

function colorLookup(rows) {
  return new Map(rows.map((d, index) => [
    d.sector,
    d.color || chartPalette[index % chartPalette.length],
  ]));
}

function allocateDots(rows, total) {
  const quotas = rows.map((d) => ({
    ...d,
    share: d.total / total,
    dots: Math.floor((d.total / total) * 100),
    remainder: ((d.total / total) * 100) % 1,
  }));
  let remaining = 100 - d3.sum(quotas, (d) => d.dots);

  quotas
    .slice()
    .sort((a, b) => d3.descending(a.remainder, b.remainder))
    .forEach((d) => {
      if (remaining > 0) {
        d.dots += 1;
        remaining -= 1;
      }
    });

  const dots = [];
  let index = 0;
  for (const group of quotas) {
    for (let i = 0; i < group.dots; i += 1) {
      dots.push({
        ...group,
        column: index % WAFFLE_COLUMNS,
        row: Math.floor(index / WAFFLE_COLUMNS),
      });
      index += 1;
    }
  }
  return dots;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
