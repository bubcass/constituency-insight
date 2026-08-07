import * as d3 from "../../_npm/d3@7.9.0/66d82917.js";
import {chartPalette} from "../config/chart-palette.dbce5681.js";
import {employmentWaffle} from "./employment-charts.e1a60c8d.js";
import {percentageStripChart} from "./percentage-strip-chart.b79c02ad.js";
import {waterfallSegmentsChart} from "./waterfall-segments-chart.69596b1d.js";

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
      xLabel: "Cumulative population aged 15+ whose education had ceased",
      tickFormat: (value) => d3.format("~s")(value),
      valueFormat: (value) => d3.format(",")(value),
      shareFormat: (value) => d3.format(".1%")(value),
      ariaLabel: title || "Highest level of education completed",
    }),
  );
  return wrap;
}

export function educationCeasedAgeWaffle(
  data,
  {width = 960, title = "", subtitle = ""} = {},
) {
  const colors = [
    "#d62728",
    "#ff7f0e",
    "#bcbd22",
    "#2ca02c",
    "#17becf",
    "#1f77b4",
    "#303591",
    "#9467bd",
    "#7f7f7f",
  ];
  return employmentWaffle(
    (Array.isArray(data) ? data : []).map((d, index) => ({
      sector: d.label,
      total: d.total,
      color: colors[index % colors.length],
    })),
    {
      width,
      title,
      subtitle,
      populationLabel: "people",
      populationContext: "people whose education has ceased",
      note: "Each dot represents approximately 1% of people in the selected area whose education has ceased.",
      ariaLabel: title || "Age at which education ceased waffle chart",
      sort: false,
    },
  );
}

export function irishLanguagePercentageBar(
  data,
  {
    width = 960,
    title = "",
    subtitle = "",
    itemLabel = "people",
    shareLabel = "of the selected population",
    note = "Each stripe represents approximately 1% of the selected population.",
  } = {},
) {
  return percentageStripChart(
    (Array.isArray(data) ? data : []).map((d, index) => ({
      category: d.category,
      total: d.total,
      color: d.color || chartPalette[index % chartPalette.length],
    })),
    {
      width,
      title,
      subtitle,
      className: "education-irish-frequency",
      itemLabel,
      shareLabel,
      note,
      ariaLabel: title || "Irish-language profile",
    },
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
