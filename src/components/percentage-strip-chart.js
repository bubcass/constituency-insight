import * as d3 from "npm:d3";
import * as Plot from "npm:@observablehq/plot";
import {chartPalette} from "../config/chart-palette.js";
import {plotStyle, responsivePlotWidth} from "../config/chart-style.js";

export function percentageStripChart(
  data,
  {
    width = 790,
    title = "",
    subtitle = "",
    className = "",
    itemLabel = "items",
    shareLabel = "of the total",
    note = "Each stripe represents approximately 1% of the total.",
    noteHtml = "",
    ariaLabel = "Composition of the total",
  } = {},
) {
  const rows = (Array.isArray(data) ? data : [])
    .map((d, index) => ({
      category: String(d.category ?? ""),
      total: Math.max(0, Number(d.total) || 0),
      color: d.color || chartPalette[index % chartPalette.length],
    }))
    .filter((d) => d.category);
  const total = d3.sum(rows, (d) => d.total) || 1;
  const cells = allocateCells(rows, total);
  const plotWidth = responsivePlotWidth(width);

  const wrap = document.createElement("figure");
  wrap.className = ["demographic-chart", "percentage-strip", className].filter(Boolean).join(" ");

  const heading = document.createElement("figcaption");
  heading.className = "demographic-chart__heading";
  heading.innerHTML = `<strong>${escapeHtml(title)}</strong>${
    subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""
  }`;

  const legend = document.createElement("div");
  legend.className = "percentage-strip__legend";
  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "percentage-strip__legend-item";
    item.innerHTML = `
      <span class="percentage-strip__swatch" style="--percentage-strip-color:${row.color}" aria-hidden="true"></span>
      <span class="percentage-strip__legend-copy">
        <strong>${escapeHtml(row.category)}</strong>
        <span>${d3.format(".1%")(row.total / total)} · ${d3.format(",")(row.total)}</span>
      </span>
    `;
    legend.appendChild(item);
  }

  const plot = Plot.plot({
    width: plotWidth,
    height: 116,
    margin: 8,
    axis: null,
    style: plotStyle(),
    x: {domain: d3.range(100)},
    y: {domain: [0]},
    color: {
      domain: rows.map((d) => d.category),
      range: rows.map((d) => d.color),
      legend: false,
    },
    marks: [
      Plot.cell(cells, {
        className: "percentage-strip__cell",
        x: "index",
        y: () => 0,
        fill: "category",
        inset: 0,
      }),
    ],
  });
  plot.setAttribute("role", "img");
  plot.setAttribute(
    "aria-label",
    `${ariaLabel}. ${rows
      .map((d) => `${d.category}: ${d3.format(".1%")(d.total / total)}`)
      .join("; ")}.`,
  );

  const plotWrap = document.createElement("div");
  plotWrap.className = "demographic-chart__plot percentage-strip__plot";
  const tooltip = document.createElement("div");
  tooltip.className = "demographic-chart__tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.style.opacity = "0";
  plotWrap.append(plot, tooltip);

  const targets = Array.from(plot.querySelectorAll(".percentage-strip__cell rect"));
  targets.forEach((target, index) => {
    const cell = cells[index];
    if (!cell) return;
    target.setAttribute("tabindex", "0");
    target.setAttribute(
      "aria-label",
      `${cell.category}: ${d3.format(",")(cell.total)} ${itemLabel}, ${d3.format(".1%")(cell.share)} ${shareLabel}`,
    );
    const show = (event) => {
      tooltip.innerHTML = `
        <strong>${escapeHtml(cell.category)}</strong>
        <span>${d3.format(",")(cell.total)} ${escapeHtml(itemLabel)}</span>
        <span>${d3.format(".1%")(cell.share)} ${escapeHtml(shareLabel)}</span>
      `;
      tooltip.style.opacity = "1";
      const shellRect = plotWrap.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const clientX = event?.clientX || targetRect.right;
      const left = Math.min(
        Math.max(clientX - shellRect.left + 12, 8),
        Math.max(8, shellRect.width - tooltip.offsetWidth - 8),
      );
      const top = Math.max(8, targetRect.top - shellRect.top - tooltip.offsetHeight - 10);
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

  const noteElement = document.createElement("p");
  noteElement.className = "percentage-strip__note";
  if (noteHtml) noteElement.innerHTML = noteHtml;
  else noteElement.textContent = note;

  wrap.append(heading, legend, plotWrap, noteElement);
  return wrap;
}

function allocateCells(rows, total) {
  const quotas = rows.map((row, index) => ({
    ...row,
    order: index,
    share: row.total / total,
    cells: Math.floor((row.total / total) * 100),
    remainder: ((row.total / total) * 100) % 1,
  }));
  let remaining = 100 - d3.sum(quotas, (d) => d.cells);

  for (const row of quotas.slice().sort((a, b) =>
    d3.descending(a.remainder, b.remainder) || d3.ascending(a.order, b.order))) {
    if (remaining <= 0) break;
    row.cells += 1;
    remaining -= 1;
  }

  const cells = [];
  let index = 0;
  for (const row of quotas) {
    for (let i = 0; i < row.cells; i += 1) {
      cells.push({...row, index});
      index += 1;
    }
  }
  return cells;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
