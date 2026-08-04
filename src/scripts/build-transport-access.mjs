import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {csvParse} from "d3-dsv";
import bbox from "@turf/bbox";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(SCRIPT_DIR, "../data");
const BUS_SOURCE_URL = "https://www.transportforireland.ie/transitData/Data/NaPTAN.json";
const RAIL_SOURCE_URL = "https://services-eu1.arcgis.com/FH5XCsx8rYXqnjF5/arcgis/rest/services/Rail_Network_Segment/FeatureServer/3";
const OUTPUT_PATH = path.join(DATA_DIR, "derived/transport-access.json");
const BUS_STOP_TYPES = new Set(["BCT", "BCS", "BCE"]);
const RAIL_STATION_TYPES = new Set(["RLY"]);

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function sourceBytes(localPath, url) {
  if (localPath) return fs.readFile(path.resolve(localPath));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download ${url}: ${response.status} ${response.statusText}`);
  return Buffer.from(await response.arrayBuffer());
}

async function railSource(localPath) {
  if (localPath) return JSON.parse(await fs.readFile(path.resolve(localPath), "utf8"));
  const features = [];
  const pageSize = 2000;
  for (let offset = 0; ; offset += pageSize) {
    const query = new URL(`${RAIL_SOURCE_URL}/query`);
    query.search = new URLSearchParams({
      where: "1=1",
      outFields: "GUID,OBJECTID,Shape__Length",
      returnGeometry: "true",
      outSR: "4326",
      geometryPrecision: "6",
      orderByFields: "OBJECTID",
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
      f: "geojson"
    });
    const response = await fetch(query);
    if (!response.ok) throw new Error(`Could not download rail geometry: ${response.status} ${response.statusText}`);
    const page = await response.json();
    if (!Array.isArray(page.features)) throw new Error(page.error?.message ?? "The rail service returned no features");
    features.push(...page.features);
    if (page.features.length < pageSize) break;
  }
  return {type: "FeatureCollection", features};
}

function cleanText(value) {
  if (value && typeof value === "object") return cleanText(value["#text"] ?? value.text ?? "");
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function asNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value == null || value === "") return null;
  const number = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(number) ? number : null;
}

function createDistrictIndex(districtGeo, constituencyByGuid) {
  const cellSize = 0.25;
  const cells = new Map();
  const features = districtGeo.features
    .map((feature) => {
      const edGuid = cleanText(feature?.properties?.ED_GUID);
      const constituency = constituencyByGuid.get(edGuid);
      if (!edGuid || !constituency) return null;
      return {
        feature,
        edGuid,
        edName: cleanText(feature?.properties?.ED_NAME ?? feature?.properties?.ED_ENGLISH),
        constituency,
        bounds: bbox(feature)
      };
    })
    .filter(Boolean);

  const key = (x, y) => `${x},${y}`;
  for (const item of features) {
    const [minX, minY, maxX, maxY] = item.bounds;
    const x0 = Math.floor(minX / cellSize);
    const x1 = Math.floor(maxX / cellSize);
    const y0 = Math.floor(minY / cellSize);
    const y1 = Math.floor(maxY / cellSize);
    for (let x = x0; x <= x1; x += 1) {
      for (let y = y0; y <= y1; y += 1) {
        const bucketKey = key(x, y);
        const bucket = cells.get(bucketKey) ?? [];
        bucket.push(item);
        cells.set(bucketKey, bucket);
      }
    }
  }

  return function locate(longitude, latitude) {
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
    const candidates = cells.get(key(Math.floor(longitude / cellSize), Math.floor(latitude / cellSize))) ?? [];
    const point = {type: "Point", coordinates: [longitude, latitude]};
    return candidates.find(({feature, bounds: [minX, minY, maxX, maxY]}) =>
      longitude >= minX && longitude <= maxX && latitude >= minY && latitude <= maxY &&
      booleanPointInPolygon(point, feature)
    ) ?? null;
  };
}

function normaliseAccessPoints(source, locate) {
  const stops = source?.NaPTAN?.StopPoints?.StopPoint ?? [];
  const records = [];
  const counts = {
    busRelevant: 0,
    busUnmatched: 0,
    stationRelevant: 0,
    stationUnmatched: 0
  };

  for (const stop of stops) {
    const stopType = cleanText(stop?.StopClassification?.StopType);
    const type = BUS_STOP_TYPES.has(stopType)
      ? "bus"
      : RAIL_STATION_TYPES.has(stopType)
        ? "station"
        : null;
    if (!type) continue;
    counts[type === "bus" ? "busRelevant" : "stationRelevant"] += 1;
    const translation = stop?.Place?.Location?.Translation ?? {};
    const latitude = asNumber(translation.Latitude);
    const longitude = asNumber(translation.Longitude);
    const district = locate(longitude, latitude);
    if (!district) {
      counts[type === "bus" ? "busUnmatched" : "stationUnmatched"] += 1;
      continue;
    }
    records.push({
      type,
      id: cleanText(stop.AtcoCode),
      name: cleanText(stop?.Descriptor?.CommonName) || (type === "station" ? "Rail station" : "Bus stop"),
      indicator: cleanText(stop?.Descriptor?.Indicator),
      stopType,
      latitude,
      longitude,
      constituency: district.constituency,
      edGuid: district.edGuid,
      edName: district.edName
    });
  }

  return {records, total: stops.length, ...counts};
}

function normaliseLuasStops(source, locate) {
  const stopAreas = source?.NaPTAN?.StopAreas?.StopArea ?? [];
  const grouped = new Map();

  for (const area of stopAreas) {
    if (cleanText(area?.StopAreaType) !== "GTMU") continue;
    const name = cleanText(area?.Name);
    const translation = area?.Location?.Translation ?? {};
    const latitude = asNumber(translation.Latitude);
    const longitude = asNumber(translation.Longitude);
    if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const key = name.toLocaleLowerCase("en-IE");
    const group = grouped.get(key) ?? {name, codes: [], latitudes: [], longitudes: []};
    group.codes.push(cleanText(area?.StopAreaCode));
    group.latitudes.push(latitude);
    group.longitudes.push(longitude);
    grouped.set(key, group);
  }

  const records = [];
  let unmatched = 0;
  for (const group of grouped.values()) {
    const latitude = group.latitudes.reduce((sum, value) => sum + value, 0) / group.latitudes.length;
    const longitude = group.longitudes.reduce((sum, value) => sum + value, 0) / group.longitudes.length;
    const district = locate(longitude, latitude);
    if (!district) {
      unmatched += 1;
      continue;
    }
    records.push({
      type: "luas",
      id: group.codes.filter(Boolean).sort().join("|") || `luas:${group.name}`,
      name: group.name,
      latitude,
      longitude,
      constituency: district.constituency,
      edGuid: district.edGuid,
      edName: district.edName
    });
  }

  return {records, sourceAreas: stopAreas.filter((area) => cleanText(area?.StopAreaType) === "GTMU").length, unmatched};
}

function midpointCoordinates(geometry) {
  const lines = geometry?.type === "LineString"
    ? [geometry.coordinates]
    : geometry?.type === "MultiLineString"
      ? geometry.coordinates
      : [];
  const segments = [];
  let total = 0;
  for (const line of lines) {
    for (let index = 1; index < line.length; index += 1) {
      const start = line[index - 1];
      const end = line[index];
      const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
      if (!Number.isFinite(length) || length === 0) continue;
      segments.push({start, end, length});
      total += length;
    }
  }
  if (!segments.length) return null;
  let remaining = total / 2;
  for (const segment of segments) {
    if (remaining > segment.length) {
      remaining -= segment.length;
      continue;
    }
    const ratio = remaining / segment.length;
    return [
      segment.start[0] + (segment.end[0] - segment.start[0]) * ratio,
      segment.start[1] + (segment.end[1] - segment.start[1]) * ratio
    ];
  }
  return segments.at(-1).end;
}

function normaliseRailSegments(source, locate) {
  const features = Array.isArray(source?.features) ? source.features : [];
  const lines = [];
  let unmatched = 0;

  for (const feature of features) {
    const midpoint = midpointCoordinates(feature.geometry);
    const longitude = midpoint?.[0];
    const latitude = midpoint?.[1];
    const district = locate(longitude, latitude);
    if (!district) {
      unmatched += 1;
      continue;
    }
    lines.push({
      type: "rail",
      id: cleanText(feature.properties?.GUID ?? feature.id),
      lengthMetres: asNumber(feature.properties?.Shape__Length) ?? 0,
      constituency: district.constituency,
      edGuid: district.edGuid,
      edName: district.edName,
      geometry: feature.geometry
    });
  }

  return {lines, total: features.length, unmatched};
}

const busPath = argumentValue("--bus");
const railPath = argumentValue("--rail");
const [busBytes, railGeo, districtGeoText, demographicsText] = await Promise.all([
  sourceBytes(busPath, BUS_SOURCE_URL),
  railSource(railPath),
  fs.readFile(path.join(DATA_DIR, "geo/electoral-districts-2022.geojson"), "utf8"),
  fs.readFile(path.join(DATA_DIR, "demographics-age-2022.csv"), "utf8")
]);

const busSource = JSON.parse(busBytes.toString("utf8"));
const districtGeo = JSON.parse(districtGeoText);
const demographics = csvParse(demographicsText);
const constituencyByGuid = new Map(demographics.map((row) => [cleanText(row.ED_GUID), cleanText(row["NEW CONSTITUENCY"])]));
const locate = createDistrictIndex(districtGeo, constituencyByGuid);
const access = normaliseAccessPoints(busSource, locate);
const luas = normaliseLuasStops(busSource, locate);
const rail = normaliseRailSegments(railGeo, locate);
const records = [...access.records, ...luas.records].sort((a, b) =>
  a.constituency.localeCompare(b.constituency, "en") ||
  a.name.localeCompare(b.name, "en")
);
const lines = rail.lines.sort((a, b) =>
  a.constituency.localeCompare(b.constituency, "en") ||
  a.edName.localeCompare(b.edName, "en") ||
  a.id.localeCompare(b.id, "en")
);

const output = {
  meta: {
    generated: new Date().toISOString(),
    busSource: BUS_SOURCE_URL,
    busSourceFile: cleanText(busSource?.NaPTAN?.["@FileName"]),
    busSourceCreated: cleanText(busSource?.NaPTAN?.["@CreationDateTime"]),
    accessInputRecords: access.total,
    busRelevantRecords: access.busRelevant,
    busMappedRecords: access.records.filter((record) => record.type === "bus").length,
    busUnmatchedRecords: access.busUnmatched,
    stationRelevantRecords: access.stationRelevant,
    stationMappedRecords: access.records.filter((record) => record.type === "station").length,
    stationUnmatchedRecords: access.stationUnmatched,
    luasSourceAreas: luas.sourceAreas,
    luasMappedStops: luas.records.length,
    luasUnmatchedStops: luas.unmatched,
    railSource: RAIL_SOURCE_URL,
    railInputSegments: rail.total,
    railMappedSegments: rail.lines.length,
    railUnmatchedSegments: rail.unmatched
  },
  records,
  lines
};

await fs.mkdir(path.dirname(OUTPUT_PATH), {recursive: true});
await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(output)}\n`);
console.log(`Wrote ${records.length.toLocaleString("en-IE")} access points and ${lines.length.toLocaleString("en-IE")} rail segments to ${OUTPUT_PATH}`);
console.log(`Bus stops: ${access.records.filter((record) => record.type === "bus").length.toLocaleString("en-IE")} mapped, ${access.busUnmatched.toLocaleString("en-IE")} unmatched`);
console.log(`Rail stations: ${access.records.filter((record) => record.type === "station").length.toLocaleString("en-IE")} mapped, ${access.stationUnmatched.toLocaleString("en-IE")} unmatched`);
console.log(`Luas stops: ${luas.records.length.toLocaleString("en-IE")} mapped, ${luas.unmatched.toLocaleString("en-IE")} unmatched`);
console.log(`Rail segments: ${rail.lines.length.toLocaleString("en-IE")} mapped, ${rail.unmatched.toLocaleString("en-IE")} unmatched`);
