import * as d3 from "../../_npm/d3@7.9.0/66d82917.js";
import {chartPalette} from "../config/chart-palette.dbce5681.js";
import {waterfallSegmentsChart} from "./waterfall-segments-chart.12242099.js";

export function educationQualificationWaterfall(
  data,
  {width = 960, title = "", subtitle = ""} = {},
) {
  const rows = (Array.isArray(data) ? data : [])
    .map((d) => ({
      qualification: String(d.qualification ?? ""),
      total: Math.max(0, Number(d.total) || 0),
    }))
    .filter((d) => d.qualification && d.total > 0)
    .sort(
      (a, b) =>
        d3.descending(a.total, b.total) ||
        d3.ascending(a.qualification, b.qualification),
    );
  const total = d3.sum(rows, (d) => d.total) || 1;
  let running = 0;
  const segments = rows.map((row, index) => {
    const x1 = running;
    const x2 = running + row.total;
    running = x2;
    return {
      Segment: row.qualification,
      value: row.total,
      share: row.total / total,
      x1,
      x2,
      color: chartPalette[index % chartPalette.length],
    };
  });

  const wrap = document.createElement("figure");
  wrap.className = "demographic-chart education-chart";
  const heading = document.createElement("figcaption");
  heading.className = "demographic-chart__heading";
  heading.innerHTML = `<strong>${escapeHtml(title)}</strong>${
    subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""
  }`;
  wrap.appendChild(heading);
  wrap.appendChild(
    waterfallSegmentsChart(segments, {
      width,
      marginLeft: 330,
      minRowHeight: 36,
      minorShareThreshold: 0,
      xLabel: "Cumulative population aged 15 and over",
      tickFormat: (value) => d3.format("~s")(value),
      valueFormat: (value) => d3.format(",")(value),
      ariaLabel: title || "Highest level of education completed",
    }),
  );
  return wrap;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
