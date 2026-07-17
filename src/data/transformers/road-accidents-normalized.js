import fs from "node:fs/promises";
import path from "node:path";
import { csvFormat, csvParse } from "d3-dsv";
import * as turf from "@turf/turf";

const ROOT = process.cwd();
const INPUT_CSV = path.join(ROOT, "src", "data", "data_road_accidents.csv");
const INPUT_GEO = path.join(ROOT, "src", "data", "geo", "constituencies.json");
const INPUT_ED_GEO = path.join(
  ROOT,
  "src",
  "data",
  "geo",
  "electoral-districts-2022.geojson",
);
const OUTPUT_CSV = path.join(
  ROOT,
  "src",
  "data",
  "derived",
  "road-accidents-normalized.csv",
);

const ROAD_USERS = [
  ["Cyclist", "cyclist_count"],
  ["Driver", "driver_count"],
  ["E-scooter/Other", "e_scooter_other_count"],
  ["Motorcyclist", "motorcyclist_count"],
  ["Passenger", "passenger_count"],
  ["Pedestrian", "pedestrian_count"],
];

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

function cleanConstituencyName(value) {
  return cleanText(value).replace(/\s*\(\d+\)\s*$/, "");
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseIncidentType(value) {
  const type = cleanText(value).toUpperCase();
  if (type.endsWith(" FATAL")) return "Fatal";
  if (type.endsWith(" NON SERIOUS INJURY")) return "Non-serious";
  if (type.endsWith(" SERIOUS INJURY")) return "Serious";
  return "Unknown";
}

function parseMonth(value) {
  const match = cleanText(value).match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return null;

  const monthLookup = new Map([
    ["jan", 1],
    ["feb", 2],
    ["mar", 3],
    ["apr", 4],
    ["may", 5],
    ["jun", 6],
    ["jul", 7],
    ["aug", 8],
    ["sep", 9],
    ["sept", 9],
    ["oct", 10],
    ["nov", 11],
    ["dec", 12],
  ]);

  const month = monthLookup.get(match[1].toLowerCase());
  const year = Number(match[2]);
  if (!month || !Number.isInteger(year)) return null;

  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function casualtyCount(row, suffix) {
  return ROAD_USERS.reduce(
    (total, [sourceName]) => total + number(row[`${sourceName} ${suffix}`]),
    0,
  );
}

function buildConstituencies(geojson) {
  return (Array.isArray(geojson?.features) ? geojson.features : [])
    .map((feature) => {
      const constituency = cleanConstituencyName(
        feature?.properties?.ENG_NAME_VALUE,
      );
      if (!constituency || !feature?.geometry) return null;
      return {
        constituency,
        constituency_slug: slugify(constituency),
        feature,
        bbox: turf.bbox(feature),
      };
    })
    .filter(Boolean);
}

function assignConstituency(longitude, latitude, constituencies) {
  const point = turf.point([longitude, latitude]);

  for (const item of constituencies) {
    const [minX, minY, maxX, maxY] = item.bbox;
    if (
      longitude < minX ||
      longitude > maxX ||
      latitude < minY ||
      latitude > maxY
    ) {
      continue;
    }

    try {
      if (turf.booleanPointInPolygon(point, item.feature)) return item;
    } catch {
      // Continue past an invalid polygon rather than dropping the build.
    }
  }

  return null;
}

function buildElectoralDistrictIndex(geojson, cellSize = 0.1) {
  const cells = new Map();

  const districts = (Array.isArray(geojson?.features) ? geojson.features : [])
    .map((feature) => {
      const electoralDistrict = cleanText(
        feature?.properties?.ED_NAME ?? feature?.properties?.ED_ENGLISH,
      );
      const electoralDistrictGuid = cleanText(feature?.properties?.ED_GUID);
      if (!electoralDistrict || !electoralDistrictGuid || !feature?.geometry) {
        return null;
      }
      return {
        electoral_district: electoralDistrict,
        electoral_district_guid: electoralDistrictGuid,
        feature,
        bbox: turf.bbox(feature),
      };
    })
    .filter(Boolean);

  for (const district of districts) {
    const [minX, minY, maxX, maxY] = district.bbox;
    for (
      let x = Math.floor(minX / cellSize);
      x <= Math.floor(maxX / cellSize);
      x += 1
    ) {
      for (
        let y = Math.floor(minY / cellSize);
        y <= Math.floor(maxY / cellSize);
        y += 1
      ) {
        const key = `${x}:${y}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(district);
      }
    }
  }

  return { cells, cellSize };
}

function assignElectoralDistrict(longitude, latitude, index) {
  const key = `${Math.floor(longitude / index.cellSize)}:${Math.floor(latitude / index.cellSize)}`;
  const candidates = index.cells.get(key) ?? [];
  const point = turf.point([longitude, latitude]);

  for (const district of candidates) {
    const [minX, minY, maxX, maxY] = district.bbox;
    if (
      longitude < minX ||
      longitude > maxX ||
      latitude < minY ||
      latitude > maxY
    ) {
      continue;
    }
    try {
      if (turf.booleanPointInPolygon(point, district.feature)) return district;
    } catch {
      // Continue past invalid district geometry.
    }
  }

  return null;
}

async function main() {
  const [csvText, geoText, electoralDistrictGeoText] = await Promise.all([
    fs.readFile(INPUT_CSV, "utf8"),
    fs.readFile(INPUT_GEO, "utf8"),
    fs.readFile(INPUT_ED_GEO, "utf8"),
  ]);

  const rows = csvParse(csvText.replace(/^\uFEFF/, ""));
  const constituencies = buildConstituencies(JSON.parse(geoText));
  const electoralDistrictIndex = buildElectoralDistrictIndex(
    JSON.parse(electoralDistrictGeoText),
  );
  const rejected = {
    invalidCoordinates: 0,
    invalidDate: 0,
    outsideConstituencies: 0,
    outsideElectoralDistricts: 0,
  };

  const normalized = [];

  for (const row of rows) {
    const longitude = Number(row.Longitude);
    const latitude = Number(row.Latitude);
    const date = parseMonth(row["Month of Year"]);

    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      rejected.invalidCoordinates += 1;
      continue;
    }
    if (!date) {
      rejected.invalidDate += 1;
      continue;
    }

    const matched = assignConstituency(longitude, latitude, constituencies);
    if (!matched) {
      rejected.outsideConstituencies += 1;
      continue;
    }

    const fatalityCount = casualtyCount(row, "Fatality");
    const seriousInjuryCount = casualtyCount(row, "Seriously Injured");
    const nonSeriousInjuryCount = casualtyCount(row, "Minorly Injured");
    const roadUserCounts = Object.fromEntries(
      ROAD_USERS.map(([sourceName, outputName]) => [
        outputName,
        number(row[`${sourceName} Fatality`]) +
          number(row[`${sourceName} Seriously Injured`]) +
          number(row[`${sourceName} Minorly Injured`]),
      ]),
    );
    const electoralDistrict = assignElectoralDistrict(
      longitude,
      latitude,
      electoralDistrictIndex,
    );
    if (!electoralDistrict) rejected.outsideElectoralDistricts += 1;

    normalized.push({
      incident_id: cleanText(row.ID ?? row["\uFEFFID"]),
      date,
      year: Number(date.slice(0, 4)),
      time_band: cleanText(row["Time Band"]),
      longitude,
      latitude,
      constituency: matched.constituency,
      constituency_slug: matched.constituency_slug,
      electoral_district: electoralDistrict?.electoral_district ?? "",
      electoral_district_guid:
        electoralDistrict?.electoral_district_guid ?? "",
      incident_type: parseIncidentType(row["Incident Type"]),
      incident_count: 1,
      fatality_count: fatalityCount,
      serious_injury_count: seriousInjuryCount,
      non_serious_injury_count: nonSeriousInjuryCount,
      casualty_count:
        fatalityCount + seriousInjuryCount + nonSeriousInjuryCount,
      ...roadUserCounts,
    });
  }

  await fs.mkdir(path.dirname(OUTPUT_CSV), { recursive: true });
  await fs.writeFile(OUTPUT_CSV, `\uFEFF${csvFormat(normalized)}\n`);

  const incidentCounts = Object.fromEntries(
    ["Fatal", "Serious", "Non-serious"].map((type) => [
      type,
      normalized.filter((row) => row.incident_type === type).length,
    ]),
  );
  const casualtyTotals = normalized.reduce(
    (totals, row) => ({
      fatal: totals.fatal + row.fatality_count,
      serious: totals.serious + row.serious_injury_count,
      nonSerious: totals.nonSerious + row.non_serious_injury_count,
    }),
    { fatal: 0, serious: 0, nonSerious: 0 },
  );

  console.log(
    JSON.stringify(
      {
        sourceRows: rows.length,
        outputRows: normalized.length,
        rejected,
        incidentCounts,
        casualtyTotals,
        output: path.relative(ROOT, OUTPUT_CSV),
      },
      null,
      2,
    ),
  );
}

await main();
