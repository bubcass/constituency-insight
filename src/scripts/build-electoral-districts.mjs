import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {fileURLToPath} from "node:url";
import {booleanValid} from "@turf/turf";

const EXPECTED_FEATURES = 3420;
const PAGE_SIZE = 250;

const args = process.argv.slice(2);
const resolution = readResolution(args);
const retention = readRetention(args);
const layerId = {20: 5, 50: 4, 100: 1}[resolution];
const SERVICE_URL =
  `https://services-eu1.arcgis.com/BuS9rtTsYEV5C0xh/ArcGIS/rest/services/` +
  `CSO_ELECTORAL_DIVISIONS_2022_Genralised_${resolution}m_view/FeatureServer/${layerId}`;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(
  scriptDir,
  "../data/geo/electoral-districts-2022.geojson",
);
const fallbackPath = path.resolve(
  scriptDir,
  "../data/geo/electoral-district-validity-fallbacks.geojson",
);
const mapshaperPath = path.resolve(
  scriptDir,
  "../../tools/electoral-districts/node_modules/.bin/mapshaper",
);
const runFile = promisify(execFile);

const existingNames = await readExistingNames(outputPath);
const featureCount = await fetchFeatureCount();

if (featureCount !== EXPECTED_FEATURES) {
  throw new Error(
    `Expected ${EXPECTED_FEATURES} CSO electoral districts, received ${featureCount}`,
  );
}

const features = [];
for (let offset = 0; offset < featureCount; offset += PAGE_SIZE) {
  const page = await fetchFeaturePage(offset);
  features.push(...page);
  console.warn(`Fetched ${Math.min(features.length, featureCount)} of ${featureCount} districts`);
}

features.sort(
  (a, b) => Number(a?.properties?.OBJECTID ?? 0) - Number(b?.properties?.OBJECTID ?? 0),
);

const guids = new Set();
for (const feature of features) {
  const properties = feature?.properties ?? {};
  const guid = String(properties.ED_GUID ?? "");
  if (!guid) throw new Error(`The ${resolution} m layer contains a feature without ED_GUID`);
  if (guids.has(guid)) throw new Error(`Duplicate ED_GUID in the ${resolution} m layer: ${guid}`);
  guids.add(guid);

  properties.ED_NAME =
    existingNames.get(guid) ?? titleCaseName(String(properties.ED_ENGLISH ?? ""));
  feature.properties = properties;
}

if (features.length !== EXPECTED_FEATURES || guids.size !== EXPECTED_FEATURES) {
  throw new Error(
    `Expected ${EXPECTED_FEATURES} unique districts, received ${features.length} features and ${guids.size} GUIDs`,
  );
}

const geojson = {
  type: "FeatureCollection",
  name: `CSO_ELECTORAL_DIVISIONS_2022_Generalised_${resolution}m`,
  crs: {
    type: "name",
    properties: {name: "urn:ogc:def:crs:OGC:1.3:CRS84"},
  },
  features,
};

const rawPath = path.join(os.tmpdir(), `electoral-districts-${process.pid}-raw.geojson`);
const simplifiedPath = path.join(
  os.tmpdir(),
  `electoral-districts-${process.pid}-simplified.geojson`,
);

try {
  await fs.writeFile(rawPath, formatGeoJSON(geojson), "utf8");
  const {stderr} = await runFile(
    mapshaperPath,
    [
      rawPath,
      "-simplify",
      "weighted",
      `${retention}%`,
      "keep-shapes",
      "-o",
      simplifiedPath,
      "format=geojson",
      "precision=0.000001",
    ],
    {maxBuffer: 10 * 1024 * 1024},
  );
  if (stderr.trim()) console.warn(stderr.trim());

  const simplified = JSON.parse(await fs.readFile(simplifiedPath, "utf8"));
  await replaceInvalidGeometry(simplified);
  assertOutput(simplified);
  simplified.name =
    `CSO_ELECTORAL_DIVISIONS_2022_Generalised_${resolution}m_` +
    `Weighted_${retention}pct`;
  simplified.crs = geojson.crs;
  await fs.writeFile(outputPath, formatGeoJSON(simplified), "utf8");
} finally {
  await Promise.all([
    fs.rm(rawPath, {force: true}),
    fs.rm(simplifiedPath, {force: true}),
  ]);
}

console.warn(
  `Wrote ${features.length} districts from the ${resolution} m source at ${retention}% retention to ${outputPath}`,
);

function readResolution(args) {
  const option = args.find((arg) => arg.startsWith("--resolution="));
  const value = Number(option?.split("=")[1] ?? 20);
  if (![20, 50, 100].includes(value)) {
    throw new Error("--resolution must be one of 20, 50, or 100");
  }
  return value;
}

function readRetention(args) {
  const option = args.find((arg) => arg.startsWith("--retain="));
  const value = Number(option?.split("=")[1] ?? 6);
  if (!Number.isFinite(value) || value <= 0 || value > 100) {
    throw new Error("--retain must be greater than 0 and no more than 100");
  }
  return value;
}

function assertOutput(collection) {
  const outputFeatures = Array.isArray(collection?.features) ? collection.features : [];
  const outputGuids = new Set(
    outputFeatures.map((feature) => String(feature?.properties?.ED_GUID ?? "")),
  );
  if (
    outputFeatures.length !== EXPECTED_FEATURES ||
    outputGuids.size !== EXPECTED_FEATURES ||
    outputGuids.has("")
  ) {
    throw new Error(
      `Simplified output has ${outputFeatures.length} features and ${outputGuids.size} valid GUIDs`,
    );
  }
  if (outputFeatures.some((feature) => !feature.geometry)) {
    throw new Error("Simplified output contains a feature without geometry");
  }
  const invalid = outputFeatures.filter((feature) => !booleanValid(feature));
  if (invalid.length) {
    throw new Error(
      `Simplified output contains invalid geometry for: ${invalid
        .map((feature) => feature.properties.ED_GUID)
        .join(", ")}`,
    );
  }
}

async function replaceInvalidGeometry(collection) {
  const invalid = collection.features.filter((feature) => !booleanValid(feature));
  if (!invalid.length) return;

  const fallbacks = JSON.parse(await fs.readFile(fallbackPath, "utf8"));
  const geometryByGuid = new Map(
    fallbacks.features.map((feature) => [
      String(feature?.properties?.ED_GUID ?? ""),
      feature.geometry,
    ]),
  );

  for (const feature of invalid) {
    const guid = String(feature?.properties?.ED_GUID ?? "");
    const geometry = geometryByGuid.get(guid);
    if (!geometry) throw new Error(`No valid fallback geometry for ${guid}`);
    feature.geometry = geometry;
  }

  console.warn(`Replaced ${invalid.length} invalid geometries with validated fallbacks`);
}

async function fetchFeatureCount() {
  const url = new URL(`${SERVICE_URL}/query`);
  url.search = new URLSearchParams({
    where: "1=1",
    returnCountOnly: "true",
    f: "json",
  });
  const response = await fetch(url, {signal: AbortSignal.timeout(120_000)});
  if (!response.ok) throw new Error(`Feature count request failed: ${response.status}`);
  const json = await response.json();
  if (json.error) throw new Error(`Feature count request failed: ${json.error.message}`);
  return Number(json.count);
}

async function fetchFeaturePage(offset) {
  const url = new URL(`${SERVICE_URL}/query`);
  url.search = new URLSearchParams({
    where: "1=1",
    outFields: "*",
    returnGeometry: "true",
    outSR: "4326",
    orderByFields: "OBJECTID",
    resultOffset: String(offset),
    resultRecordCount: String(PAGE_SIZE),
    f: "geojson",
  });
  const response = await fetch(url, {signal: AbortSignal.timeout(120_000)});
  if (!response.ok) {
    throw new Error(`Feature request at offset ${offset} failed: ${response.status}`);
  }
  const json = await response.json();
  if (json.error) {
    throw new Error(`Feature request at offset ${offset} failed: ${json.error.message}`);
  }
  if (!Array.isArray(json.features)) {
    throw new Error(`Feature request at offset ${offset} returned no feature array`);
  }
  return json.features;
}

async function readExistingNames(filePath) {
  try {
    const geojson = JSON.parse(await fs.readFile(filePath, "utf8"));
    return new Map(
      (geojson.features ?? []).map((feature) => [
        String(feature?.properties?.ED_GUID ?? ""),
        String(feature?.properties?.ED_NAME ?? ""),
      ]),
    );
  } catch (error) {
    if (error?.code === "ENOENT") return new Map();
    throw error;
  }
}

function titleCaseName(value) {
  return value
    .toLocaleLowerCase("en-IE")
    .replace(/(^|[\s\-/('])\p{L}/gu, (match) => match.toLocaleUpperCase("en-IE"));
}

function formatGeoJSON(collection) {
  const header = [
    "{",
    `  \"type\": ${JSON.stringify(collection.type)},`,
    `  \"name\": ${JSON.stringify(collection.name)},`,
    `  \"crs\": ${JSON.stringify(collection.crs)},`,
    '  "features": [',
  ];
  const featureLines = collection.features.map(
    (feature, index) => `    ${JSON.stringify(feature)}${index + 1 < collection.features.length ? "," : ""}`,
  );
  return [...header, ...featureLines, "  ]", "}", ""].join("\n");
}
