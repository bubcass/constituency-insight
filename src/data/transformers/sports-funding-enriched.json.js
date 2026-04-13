import fs from "node:fs/promises";
import path from "node:path";
import { csvParse } from "d3-dsv";
import * as turf from "@turf/turf";

const ROOT = process.cwd();

const INPUT_CSV = path.join(ROOT, "src", "data", "data_sports_funding.csv");
const INPUT_GEO = path.join(ROOT, "src", "data", "geo", "constituencies.json");
const OUTPUT_JSON = path.join(
  ROOT,
  "src",
  "data",
  "derived",
  "sports-funding-enriched.json",
);

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function cleanConstituencyName(name) {
  return cleanText(name).replace(/\s*\(\d+\)\s*$/, "");
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function toMoneyNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;

  const n = Number(
    String(value ?? "")
      .replace(/[€$,]/g, "")
      .replace(/\s+/g, "")
      .trim(),
  );

  return Number.isFinite(n) ? n : NaN;
}

function buildConstituencyFeatures(geojson) {
  const features = Array.isArray(geojson?.features) ? geojson.features : [];

  return features
    .map((feature) => {
      const rawName = feature?.properties?.ENG_NAME_VALUE ?? "";
      const constituency = cleanConstituencyName(rawName);

      if (!constituency || !feature?.geometry) return null;

      return {
        constituency,
        constituencySlug: slugify(constituency),
        county: cleanText(feature?.properties?.COUNTY ?? ""),
        feature,
      };
    })
    .filter(Boolean);
}

function assignConstituency(record, constituencyFeatures) {
  const pt = turf.point([record.__lon, record.__lat]);

  for (const item of constituencyFeatures) {
    try {
      if (turf.booleanPointInPolygon(pt, item.feature)) {
        return {
          __constituency: item.constituency,
          __constituencySlug: item.constituencySlug,
        };
      }
    } catch {
      // Ignore invalid geometry edge cases and continue.
    }
  }

  return {
    __constituency: "",
    __constituencySlug: "",
  };
}

async function main() {
  const [csvText, geoText] = await Promise.all([
    fs.readFile(INPUT_CSV, "utf8"),
    fs.readFile(INPUT_GEO, "utf8"),
  ]);

  const rows = csvParse(csvText);
  const geojson = JSON.parse(geoText);
  const constituencyFeatures = buildConstituencyFeatures(geojson);

  const enriched = rows
    .map((row) => {
      const record = {
        ...row,
        __lat: toFiniteNumber(row.latitude),
        __lon: toFiniteNumber(row.longitude),
        __amount: toMoneyNumber(row.amount_allocated),
        __category: cleanText(row.sport_type) || "Unspecified",
        __year: cleanText(row.year),
        __entity: cleanText(row.organisation),
        __title: cleanText(row.project_title),
        __county: cleanText(row.county),
      };

      return record;
    })
    .filter((d) => Number.isFinite(d.__lat) && Number.isFinite(d.__lon))
    .map((record) => ({
      ...record,
      ...assignConstituency(record, constituencyFeatures),
    }))
    .filter((d) => d.__constituency);

  await fs.mkdir(path.dirname(OUTPUT_JSON), { recursive: true });
  await fs.writeFile(OUTPUT_JSON, `${JSON.stringify(enriched, null, 2)}\n`);

  console.log(
    `Wrote ${enriched.length.toLocaleString("en-IE")} records to ${path.relative(ROOT, OUTPUT_JSON)}`,
  );
}

await main();
