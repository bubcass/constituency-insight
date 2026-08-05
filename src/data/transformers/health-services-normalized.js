import fs from "node:fs/promises";
import path from "node:path";
import {csvFormat, csvParse} from "d3-dsv";
import * as turf from "@turf/turf";

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, "src", "data", "source");
const OUTPUT_CSV = path.join(ROOT, "src", "data", "derived", "health-services-normalized.csv");

const SOURCES = [
  {file: "health-centres-hse-ireland.csv", type: "health-centre"},
  {file: "hospitals-hse-ireland.csv", type: "hospital"},
  {file: "gps-hse-ireland.csv", type: "gp"},
  {file: "pharmacies-hse-ireland.csv", type: "pharmacy"},
];

const WINDOWS_1252_BYTES = new Map([
  ["€", 0x80], ["‚", 0x82], ["ƒ", 0x83], ["„", 0x84], ["…", 0x85],
  ["†", 0x86], ["‡", 0x87], ["ˆ", 0x88], ["‰", 0x89], ["Š", 0x8a],
  ["‹", 0x8b], ["Œ", 0x8c], ["Ž", 0x8e], ["‘", 0x91], ["’", 0x92],
  ["“", 0x93], ["”", 0x94], ["•", 0x95], ["–", 0x96], ["—", 0x97],
  ["˜", 0x98], ["™", 0x99], ["š", 0x9a], ["›", 0x9b], ["œ", 0x9c],
  ["ž", 0x9e], ["Ÿ", 0x9f],
]);
const UTF8_DECODER = new TextDecoder("utf-8", {fatal: true});
const MOJIBAKE_MARKERS = /[ÃÂâðƒ]/g;

function mojibakeScore(value) {
  return (value.match(MOJIBAKE_MARKERS) ?? []).length;
}

function encodeWindows1252(value) {
  const bytes = [];
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0xff) bytes.push(codePoint);
    else if (WINDOWS_1252_BYTES.has(character)) bytes.push(WINDOWS_1252_BYTES.get(character));
    else return null;
  }
  return Uint8Array.from(bytes);
}

function repairMojibakeToken(token) {
  let repaired = token;
  for (let pass = 0; pass < 3 && mojibakeScore(repaired); pass += 1) {
    const bytes = encodeWindows1252(repaired);
    if (!bytes) break;
    try {
      const candidate = UTF8_DECODER.decode(bytes);
      if (mojibakeScore(candidate) >= mojibakeScore(repaired)) break;
      repaired = candidate;
    } catch {
      break;
    }
  }
  return repaired;
}

function repairMojibake(value) {
  return value.replace(/\S+/g, (token) => mojibakeScore(token) ? repairMojibakeToken(token) : token);
}

function cleanText(value) {
  const text = repairMojibake(String(value ?? "")).replace(/\s+/g, " ").trim();
  return /^(?:null|undefined)$/i.test(text) ? "" : text;
}

function cleanConstituencyName(value) {
  return cleanText(value).replace(/\s*\(\d+\)\s*$/, "");
}

function joinAddress(...parts) {
  return Array.from(new Set(parts.map(cleanText).filter(Boolean))).join(", ");
}

function buildSpatialItems(geojson, toProperties) {
  return (geojson?.features ?? []).map((feature) => {
    if (!feature?.geometry) return null;
    const properties = toProperties(feature.properties ?? {});
    if (!properties) return null;
    return {feature, bbox: turf.bbox(feature), ...properties};
  }).filter(Boolean);
}

function buildGridIndex(items, cellSize = 0.1) {
  const cells = new Map();
  for (const item of items) {
    const [minX, minY, maxX, maxY] = item.bbox;
    for (let x = Math.floor(minX / cellSize); x <= Math.floor(maxX / cellSize); x += 1) {
      for (let y = Math.floor(minY / cellSize); y <= Math.floor(maxY / cellSize); y += 1) {
        const key = `${x}:${y}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(item);
      }
    }
  }
  return {cells, cellSize};
}

function assignPoint(longitude, latitude, index) {
  const key = `${Math.floor(longitude / index.cellSize)}:${Math.floor(latitude / index.cellSize)}`;
  const point = turf.point([longitude, latitude]);
  for (const item of index.cells.get(key) ?? []) {
    const [minX, minY, maxX, maxY] = item.bbox;
    if (longitude < minX || longitude > maxX || latitude < minY || latitude > maxY) continue;
    try {
      if (turf.booleanPointInPolygon(point, item.feature)) return item;
    } catch {
      // Ignore invalid boundary fragments and continue checking candidates.
    }
  }
  return null;
}

function coordinates(row, type) {
  if (type === "health-centre") return [Number(row.lat), Number(row.lon)];
  if (type === "gp") return [Number(row.lat), Number(row.lon)];
  return [Number(row.POINT_X), Number(row.POINT_Y)];
}

function nameFor(row, type) {
  if (type === "gp") return cleanText(row.ServiceName) || joinAddress(row.Address, row.Town_City);
  return cleanText(row.name) || cleanText(row.alternate_name) || (type === "hospital" ? "Hospital" : "Unnamed service");
}

function addressFor(row, type) {
  if (type === "gp") return joinAddress(row.Address, row.Address1, row.Town_City, row.County, row.Eircode);
  if (type === "hospital") return joinAddress(row.address1, row.address2, row.address3, row.address4, row.Eircode);
  return joinAddress(row.address1, row.address2, row.address3, row.address4, row.address5);
}

function normalizedRow(row, type, sourceRow) {
  const [longitude, latitude] = coordinates(row, type);
  const practitioner = type === "gp" ? joinAddress(row.GPFirstname, row.GPSurname) : "";
  return {
    source_row: sourceRow,
    service_type: type,
    name: nameFor(row, type),
    subtype: cleanText(row.subcategory),
    address: addressFor(row, type),
    eircode: cleanText(row.Eircode) || cleanText(row.address5),
    telephone: cleanText(row.Telephone),
    email: cleanText(row.Email),
    website: cleanText(row.Website),
    practitioner,
    longitude,
    latitude,
  };
}

function aggregateLocations(rows) {
  const locations = new Map();
  for (const row of rows) {
    const key = [row.service_type, row.longitude.toFixed(6), row.latitude.toFixed(6), row.name.toLowerCase()].join("|");
    const existing = locations.get(key);
    if (!existing) {
      locations.set(key, {...row, practitioners: row.practitioner ? new Set([row.practitioner]) : new Set()});
      continue;
    }
    if (row.practitioner) existing.practitioners.add(row.practitioner);
    for (const field of ["subtype", "address", "eircode", "telephone", "email", "website"]) {
      if (!existing[field] && row[field]) existing[field] = row[field];
    }
  }
  return Array.from(locations.values());
}

async function main() {
  const [constituencyText, districtText, ...csvTexts] = await Promise.all([
    fs.readFile(path.join(ROOT, "src", "data", "geo", "constituencies.json"), "utf8"),
    fs.readFile(path.join(ROOT, "src", "data", "geo", "electoral-districts-2022.geojson"), "utf8"),
    ...SOURCES.map(({file}) => fs.readFile(path.join(SOURCE_DIR, file), "utf8")),
  ]);

  const constituencyIndex = buildGridIndex(buildSpatialItems(JSON.parse(constituencyText), (properties) => {
    const constituency = cleanConstituencyName(properties.ENG_NAME_VALUE);
    return constituency ? {constituency} : null;
  }));
  const districtIndex = buildGridIndex(buildSpatialItems(JSON.parse(districtText), (properties) => {
    const edGuid = cleanText(properties.ED_GUID);
    const edName = cleanText(properties.ED_NAME ?? properties.ED_ENGLISH);
    return edGuid && edName ? {edGuid, edName} : null;
  }));

  const sourceCounts = {};
  const candidates = [];
  SOURCES.forEach(({type}, sourceIndex) => {
    const rows = csvParse(csvTexts[sourceIndex].replace(/^\uFEFF/, ""));
    sourceCounts[type] = rows.length;
    rows.forEach((row, index) => candidates.push(normalizedRow(row, type, index + 1)));
  });

  const rejected = {invalidCoordinates: 0, outsideConstituencies: 0, outsideElectoralDistricts: 0};
  const valid = [];
  for (const row of candidates) {
    if (!Number.isFinite(row.longitude) || !Number.isFinite(row.latitude)) {
      rejected.invalidCoordinates += 1;
      continue;
    }
    const constituency = assignPoint(row.longitude, row.latitude, constituencyIndex);
    if (!constituency) {
      rejected.outsideConstituencies += 1;
      continue;
    }
    const district = assignPoint(row.longitude, row.latitude, districtIndex);
    if (!district) rejected.outsideElectoralDistricts += 1;
    valid.push({...row, ...constituency, edGuid: district?.edGuid ?? "", edName: district?.edName ?? ""});
  }

  const output = aggregateLocations(valid).map((row, index) => ({
    service_id: `health-${String(index + 1).padStart(5, "0")}`,
    service_type: row.service_type,
    name: row.name,
    subtype: row.subtype,
    address: row.address,
    eircode: row.eircode,
    telephone: row.telephone,
    email: row.email,
    website: row.website,
    practitioner_count: row.service_type === "gp" ? Math.max(1, row.practitioners.size) : "",
    practitioners: Array.from(row.practitioners).sort((a, b) => a.localeCompare(b, "en")).join("; "),
    longitude: row.longitude,
    latitude: row.latitude,
    constituency: row.constituency,
    electoral_district: row.edName,
    electoral_district_guid: row.edGuid,
  }));

  await fs.mkdir(path.dirname(OUTPUT_CSV), {recursive: true});
  await fs.writeFile(OUTPUT_CSV, `\uFEFF${csvFormat(output)}\n`);
  console.log(JSON.stringify({sourceCounts, candidateRows: candidates.length, outputLocations: output.length, rejected, outputByType: Object.fromEntries(SOURCES.map(({type}) => [type, output.filter((row) => row.service_type === type).length]))}, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
