import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";

export function waterfallSegmentsChart(
  segments,
  {
    width = 1000,
    title = null,
    caption = null,
    fontFamily = "IBM Plex Sans",
    minRowHeight = 32,
    minorShareThreshold = 0.01,
  } = {},
) {
  const safeSegments = Array.isArray(segments) ? segments : [];

  const majorSegments = safeSegments.filter(
    (d) => (Number(d.share) || 0) >= minorShareThreshold,
  );

  const minorSegments = safeSegments.filter(
    (d) => (Number(d.share) || 0) < minorShareThreshold,
  );

  const rowCount = Math.max(majorSegments.length, 1);
  const height = Math.max(220, rowCount * minRowHeight + 90);

  const maxValue = d3.max(safeSegments, (d) => d.x2) ?? 1;
  const labelThreshold = maxValue * 0.08;

  const wrap = document.createElement("div");
  wrap.className = "waterfall-segments-chart-wrap";

  function formatMillionsTick(value) {
    return `€${d3.format("~g")(Number(value || 0) / 1_000_000)}m`;
  }

  function formatMillionsLabel(value) {
    return `€${(Number(value || 0) / 1_000_000).toFixed(2)}m`;
  }

  const chart = Plot.plot({
    width,
    height,
    marginLeft: 120,
    marginRight: 30,
    marginTop: 50,
    marginBottom: 28,
    grid: true,
    title,
    caption,
    style: {
      fontSize: 12,
      fontFamily,
    },
    x: {
      label: "Funding (€ millions)",
      axis: "top",
      grid: true,
      tickFormat: (d) => formatMillionsTick(d),
      domain: [0, maxValue],
    },
    y: {
      domain: majorSegments.map((d) => d.Segment),
      label: null,
      tickPadding: 6,
      tickSize: 0,
      padding: 0.35,
    },
    marks: [
      Plot.barX(majorSegments, {
        x1: "x1",
        x2: "x2",
        y: "Segment",
        fill: "color",
        stroke: "white",
        strokeWidth: 0.5,
        rx: 3,
      }),

      Plot.ruleX(
        majorSegments.filter((d) => d.x2 - d.x1 < labelThreshold),
        {
          x: "x1",
          x2: (d) => Math.max(0, d.x1 - maxValue * 0.012),
          y: "Segment",
          stroke: "#999",
        },
      ),

      Plot.text(majorSegments, {
        x: (d) => {
          const segmentWidth = d.x2 - d.x1;
          return segmentWidth < labelThreshold
            ? Math.max(0, d.x1 - maxValue * 0.055)
            : (d.x1 + d.x2) / 2;
        },
        y: "Segment",
        text: (d) =>
          `${formatMillionsLabel(d.value)} (${d3.format(".0%")(d.share)})`,
        textAnchor: (d) => {
          const segmentWidth = d.x2 - d.x1;
          return segmentWidth < labelThreshold ? "end" : "middle";
        },
        fill: (d) => {
          const segmentWidth = d.x2 - d.x1;
          return segmentWidth < labelThreshold ? "#4a463d" : "white";
        },
        dx: 0,
        dy: 0,
        lineAnchor: "middle",
        fontSize: 10,
        fontWeight: 600,
      }),
    ],
  });

  wrap.appendChild(chart);

  if (minorSegments.length) {
    const names = minorSegments.map((d) => d.Segment);

    let summaryText = "";
    if (names.length === 1) {
      summaryText = `${names[0]} also received funding totalling less than 1% of the total.`;
    } else if (names.length === 2) {
      summaryText = `${names[0]} and ${names[1]} also received funding totalling less than 1% of the total.`;
    } else {
      summaryText = `${names.slice(0, -1).join(", ")}, and ${
        names[names.length - 1]
      } also received funding totalling less than 1% of the total.`;
    }

    const note = document.createElement("p");
    note.className = "waterfall-segments-chart__note";
    note.style.margin = "0.75rem 0 0";
    note.style.fontSize = "0.95rem";
    note.style.lineHeight = "1.45";
    note.style.color = "var(--text-soft, #5f5a50)";
    note.textContent = summaryText;

    wrap.appendChild(note);
  }

  return wrap;
}
