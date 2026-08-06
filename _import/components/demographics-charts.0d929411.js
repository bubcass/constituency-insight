import * as d3 from "../../_npm/d3@7.9.0/66d82917.js";
import * as Plot from "../../_npm/@observablehq/plot@0.6.17/a96a6bbb.js";
import { chartColors, chartPalette } from "../config/chart-palette.dbce5681.js";
import {chartStyle, plotStyle, responsivePlotWidth} from "../config/chart-style.e62386e1.js";
import { employmentWaffle } from "./employment-charts.d9b90483.js";

const FEMALE = chartColors.orange;
const MALE = chartColors.blue;

function chartFrame(title, subtitle) {
  const wrap = document.createElement("figure");
  wrap.className = "demographic-chart";

  const heading = document.createElement("figcaption");
  heading.className = "demographic-chart__heading";
  heading.innerHTML = `<strong>${title}</strong>${subtitle ? `<span>${subtitle}</span>` : ""}`;
  wrap.appendChild(heading);

  return wrap;
}

function chartWithTooltip(chart, values, tooltipHTML, { targetSelector = "rect" } = {}) {
  const shell = document.createElement("div");
  shell.className = "demographic-chart__plot";

  const tooltip = document.createElement("div");
  tooltip.className = "demographic-chart__tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.style.opacity = "0";

  shell.append(chart, tooltip);

  const targets = Array.from(chart.querySelectorAll(targetSelector)).slice(-values.length);

  function show(event, value) {
    tooltip.innerHTML = tooltipHTML(value);
    tooltip.style.opacity = "1";

    const shellRect = shell.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth || 170;
    const tooltipHeight = tooltip.offsetHeight || 54;
    const clientX = event?.clientX ?? shellRect.left + shellRect.width / 2;
    const clientY = event?.clientY ?? shellRect.top + shellRect.height / 2;

    let left = clientX - shellRect.left + 12;
    let top = clientY - shellRect.top - tooltipHeight - 12;

    if (left + tooltipWidth > shellRect.width - 8) {
      left = shellRect.width - tooltipWidth - 8;
    }
    if (left < 8) left = 8;
    if (top < 8) top = clientY - shellRect.top + 12;
    if (top + tooltipHeight > shellRect.height - 8) {
      top = shellRect.height - tooltipHeight - 8;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function hide() {
    tooltip.style.opacity = "0";
  }

  targets.forEach((target, index) => {
    const value = values[index];
    if (!value) return;

    target.classList.add("demographic-chart__hit-target");
    target.style.cursor = "pointer";
    target.setAttribute("tabindex", "0");
    target.setAttribute("aria-label", `${value.sex}, age ${value.ageBand}: ${d3.format(",")(value.population)} people`);
    target.addEventListener("mousemove", (event) => show(event, value));
    target.addEventListener("mouseenter", (event) => show(event, value));
    target.addEventListener("mouseleave", hide);
    target.addEventListener("focus", () => {
      const rect = target.getBoundingClientRect();
      show({clientX: rect.right, clientY: rect.top + rect.height / 2}, value);
    });
    target.addEventListener("blur", hide);
  });

  return shell;
}

function populationDotUnit(values) {
  const maxPopulation = d3.max(values, (d) => d.population) || 1;
  const roughUnit = maxPopulation / 150;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(1, roughUnit)));
  const normalized = roughUnit / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

export function agePyramidWaffle(data, { width = 790, title = "", subtitle = "" } = {}) {
  const wrap = chartFrame(title, subtitle);
  const plotWidth = responsivePlotWidth(width);
  const values = data.map((d) => ({
    ...d,
    plottedPopulation: d.sex === "Female" ? -d.population : d.population,
  }));
  const max = d3.max(values, (d) => Math.abs(d.plottedPopulation)) || 1;
  const ageOrder = Array.from(new Set(values.map((d) => d.ageBand))).reverse();
  const dotUnit = populationDotUnit(values);

  const chart = Plot.plot({
      width: plotWidth,
      height: Math.max(390, Math.min(500, plotWidth * 0.6)),
      marginTop: 42,
      marginRight: 24,
      marginBottom: 36,
      marginLeft: plotWidth < 560 ? 60 : 78,
      style: plotStyle(),
      x: {
        label: null,
        domain: [-max * 1.08, max * 1.08],
        tickFormat: (value) => d3.format("~s")(Math.abs(value)),
        grid: true,
      },
      y: { label: null, domain: ageOrder, tickSize: 0, padding: 0 },
      color: {
        domain: ["Female", "Male"],
        range: [FEMALE, MALE],
        legend: true,
        label: "Sex",
      },
      marks: [
        Plot.waffleX(values, {
          x: "plottedPopulation",
          y: "ageBand",
          fill: "sex",
          unit: dotUnit,
          gap: 1.4,
          rx: "100%",
        }),
        Plot.ruleX([0], { stroke: chartStyle.baseline, strokeWidth: 1 }),
        Plot.rectX(values, {
          x1: (d) => d.sex === "Female" ? -max * 1.08 : 0,
          x2: (d) => d.sex === "Female" ? 0 : max * 1.08,
          y: "ageBand",
          fill: "transparent",
          insetTop: 1,
          insetBottom: 1,
        }),
      ],
    });

  const chartShell = chartWithTooltip(
    chart,
    values,
    (d) => `<strong>${d.sex}, age ${d.ageBand}</strong><span>${d3.format(",")(d.population)} people</span>`,
    {targetSelector: 'g[aria-label="rect"] rect'},
  );
  const note = document.createElement("p");
  note.className = "demographic-chart__note";
  note.textContent = `Each dot represents approximately ${d3.format(",")(dotUnit)} ${dotUnit === 1 ? "person" : "people"}; hover or focus for the exact count.`;

  wrap.append(chartShell, note);

  return wrap;
}

// Retained as a rollback option while the dot-based pyramid is evaluated.
export function agePyramidLollipop(data, { width = 790, title = "", subtitle = "" } = {}) {
  const wrap = chartFrame(title, subtitle);
  const plotWidth = responsivePlotWidth(width);
  const values = data.map((d) => ({
    ...d,
    plottedPopulation: d.sex === "Female" ? -d.population : d.population,
  }));
  const max = d3.max(values, (d) => Math.abs(d.plottedPopulation)) || 1;
  const ageOrder = Array.from(new Set(values.map((d) => d.ageBand))).reverse();

  const chart = Plot.plot({
    width: plotWidth,
    height: Math.max(340, Math.min(470, plotWidth * 0.52)),
    marginTop: 42,
    marginRight: 24,
    marginBottom: 36,
    marginLeft: plotWidth < 560 ? 60 : 78,
    style: plotStyle(),
    x: {
      label: null,
      domain: [-max * 1.08, max * 1.08],
      tickFormat: (value) => d3.format("~s")(Math.abs(value)),
      grid: true,
    },
    y: { label: null, domain: ageOrder, tickSize: 0, padding: 0 },
    color: {
      domain: ["Female", "Male"],
      range: [FEMALE, MALE],
      legend: true,
      label: "Sex",
    },
    marks: [
      Plot.link(values, {
        x1: 0,
        x2: "plottedPopulation",
        y1: "ageBand",
        y2: "ageBand",
        stroke: "sex",
        strokeWidth: 2.25,
      }),
      Plot.dot(values, {
        x: "plottedPopulation",
        y: "ageBand",
        fill: "sex",
        stroke: "sex",
        r: 5,
      }),
      Plot.ruleX([0], { stroke: chartStyle.baseline, strokeWidth: 1 }),
      Plot.rectX(values, {
        x1: (d) => d.sex === "Female" ? -max * 1.08 : 0,
        x2: (d) => d.sex === "Female" ? 0 : max * 1.08,
        y: "ageBand",
        fill: "transparent",
        insetTop: 1,
        insetBottom: 1,
      }),
    ],
  });

  wrap.appendChild(
    chartWithTooltip(
      chart,
      values,
      (d) => `<strong>${d.sex}, age ${d.ageBand}</strong><span>${d3.format(",")(d.population)} people</span>`,
      {targetSelector: 'g[aria-label="rect"] rect'},
    ),
  );

  return wrap;
}

// Change this alias to agePyramidLollipop for an immediate rollback.
export const agePyramid = agePyramidWaffle;

export function generationPercentageWaffle(data, { width = 790, title = "", subtitle = "" } = {}) {
  return employmentWaffle(
    data.map((d, index) => ({
      sector: d.ageBand,
      total: d.population,
      color: chartPalette[index % chartPalette.length],
    })),
    {
      width,
      title,
      subtitle,
      populationLabel: "people",
      populationContext: "the selected area's population",
      note: "Each dot represents approximately 1% of the selected area's population.",
      ariaLabel: title || "Population by age band waffle chart",
      sort: false,
    },
  );
}
