#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import * as d3 from "d3";

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  console.error(
    "Usage: node build-waterfall-segments.js <input-enriched.json> <output.json>",
  );
  process.exit(1);
}

const raw = fs.readFileSync(inputPath, "utf8");
const parsed = JSON.parse(raw);
const rows = Array.isArray(parsed?.data) ? parsed.data : Array.isArray(parsed) ? parsed : [];

if (!rows.length) {
  console.error("No rows found in input.");
  process.exit(1);
}

const colorPalette = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
];

const colorMap = new Map();

function getColor(category) {
  if (!colorMap.has(category)) {
    colorMap.set(category, colorPalette[colorMap.size % colorPalette.length]);
  }
  return colorMap.get(category);
}

function cleanString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function toNumber(value) {
  return Number(value ?? 0) || 0;
}

/**
 * Expected enriched input fields:
 * - __constituency
 * - __year
 * - __category
 * - __amount
 *
 * Output:
 * [
 *   {
 *     constituency: "Kildare North",
 *     period: "2020",
 *     total: 600000,
 *     segments: [
 *       {
 *         Segment: "Gaelic Games",
 *         value: 450000,
 *         color: "#1f77b4",
 *         x1: 0,
 *         x2: 450000,
 *         share: 0.75
 *       }
 *     ]
 *   }
 * ]
 */
const grouped = d3.rollups(
  rows.filter(
    (d) =>
      cleanString(d.__constituency) &&
      cleanString(d.__year) &&
      cleanString(d.__category) &&
      toNumber(d.__amount) > 0,
  ),
  (values) => d3.sum(values, (d) => toNumber(d.__amount)),
  (d) => cleanString(d.__constituency),
  (d) => cleanString(d.__year),
  (d) => cleanString(d.__category),
);

const output = [];

for (const [constituency, periods] of grouped) {
  for (const [period, categories] of periods) {
    const categoryRows = categories
      .map(([Segment, value]) => ({
        Segment,
        value: toNumber(value),
      }))
      .filter((d) => d.value > 0)
      .sort(
        (a, b) =>
          d3.descending(a.value, b.value) ||
          d3.ascending(a.Segment, b.Segment),
      );

    const total = d3.sum(categoryRows, (d) => d.value);

    let running = 0;
    const segments = categoryRows.map((d) => {
      const x1 = running;
      const x2 = running + d.value;
      running = x2;

      return {
        Segment: d.Segment,
        value: d.value,
        color: getColor(d.Segment),
        x1,
        x2,
        share: total > 0 ? d.value / total : 0,
      };
    });

    output.push({
      constituency,
      period,
      total,
      segments,
    });
  }
}

output.sort(
  (a, b) =>
    d3.ascending(a.constituency, b.constituency) ||
    d3.ascending(String(a.period), String(b.period)),
);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

console.log(`Built ${output.length} constituency-period waterfall records`);
console.log(`Saved to ${outputPath}`);
