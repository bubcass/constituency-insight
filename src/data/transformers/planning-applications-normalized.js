import fs from "node:fs/promises";
import path from "node:path";
import {gunzipSync} from "node:zlib";
import {csvFormat, csvParse} from "d3-dsv";
import * as turf from "@turf/turf";

const ROOT = process.cwd();
const INPUT_CSV_GZ = path.join(
  ROOT,
  "src",
  "data",
  "source",
  "irish-planning-applications-map-feed.csv.gz"
);
const INPUT_GEO = path.join(ROOT, "src", "data", "geo", "constituencies.json");
const INPUT_ED_GEO = path.join(
  ROOT,
  "src",
  "data",
  "geo",
  "electoral-districts-2022.geojson"
);
const OUTPUT_CSV = path.join(
  ROOT,
  "src",
  "data",
  "derived",
  "planning-applications-normalized.csv"
);

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
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

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDevelopmentType(value) {
  const type = cleanText(value).toLowerCase();
  const labels = new Map([
    ["new dwelling / one-off house", "New dwelling / one-off house"],
    ["new multi-unit housing", "New multi-unit housing"],
    ["extension / alteration", "Extension / alteration"],
    ["change of use to housing", "Change of use to housing"],
    ["retention / regularisation", "Retention / regularisation"],
    ["revision / amendment", "Revision / amendment"],
    ["domestic ancillary", "Domestic ancillary"],
    ["other residential", "Other residential"]
  ]);
  return labels.get(type) ?? "Other residential";
}

function buildConstituencies(geojson) {
  return (Array.isArray(geojson?.features) ? geojson.features : [])
    .map((feature) => {
      const constituency = cleanConstituencyName(
        feature?.properties?.ENG_NAME_VALUE
      );
      if (!constituency || !feature?.geometry) return null;
      return {
        constituency,
        constituency_slug: slugify(constituency),
        feature,
        bbox: turf.bbox(feature)
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
      // Continue past invalid polygon geometry rather than dropping the build.
    }
  }

  return null;
}

function buildElectoralDistrictIndex(geojson, cellSize = 0.1) {
  const cells = new Map();
  const districts = (Array.isArray(geojson?.features) ? geojson.features : [])
    .map((feature) => {
      const electoralDistrict = cleanText(
        feature?.properties?.ED_NAME ?? feature?.properties?.ED_ENGLISH
      );
      const electoralDistrictGuid = cleanText(feature?.properties?.ED_GUID);
      if (!electoralDistrict || !electoralDistrictGuid || !feature?.geometry) {
        return null;
      }
      return {
        electoral_district: electoralDistrict,
        electoral_district_guid: electoralDistrictGuid,
        feature,
        bbox: turf.bbox(feature)
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

  return {cells, cellSize};
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
  const [compressedCsv, geoText, electoralDistrictGeoText] = await Promise.all([
    fs.readFile(INPUT_CSV_GZ),
    fs.readFile(INPUT_GEO, "utf8"),
    fs.readFile(INPUT_ED_GEO, "utf8")
  ]);

  const rows = csvParse(
    gunzipSync(compressedCsv).toString("utf8").replace(/^\uFEFF/, "")
  );
  const latestSourceYear = rows.reduce((latest, row) => {
    const year = Number(
      row.received_year || cleanText(row.received_date).slice(0, 4)
    );
    return Number.isFinite(year) ? Math.max(latest, year) : latest;
  }, 0);
  const firstIncludedYear = latestSourceYear - 5;
  const constituencies = buildConstituencies(JSON.parse(geoText));
  const electoralDistrictIndex = buildElectoralDistrictIndex(
    JSON.parse(electoralDistrictGeoText)
  );
  const rejected = {
    outsideRollingWindow: 0,
    invalidCoordinates: 0,
    invalidDate: 0,
    outsideConstituencies: 0,
    outsideElectoralDistricts: 0
  };
  const normalized = [];

  for (const row of rows) {
    const longitude = Number(row.longitude);
    const latitude = Number(row.latitude);
    const receivedDate = cleanText(row.received_date);
    const year = Number(row.received_year || receivedDate.slice(0, 4));

    if (year < firstIncludedYear || year > latestSourceYear) {
      rejected.outsideRollingWindow += 1;
      continue;
    }
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      rejected.invalidCoordinates += 1;
      continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(receivedDate) || !Number.isInteger(year)) {
      rejected.invalidDate += 1;
      continue;
    }

    const matched = assignConstituency(longitude, latitude, constituencies);
    if (!matched) {
      rejected.outsideConstituencies += 1;
      continue;
    }

    const residentialUnits = numberOrZero(row.residential_units_reported);
    const electoralDistrict = assignElectoralDistrict(
      longitude,
      latitude,
      electoralDistrictIndex
    );
    if (!electoralDistrict) rejected.outsideElectoralDistricts += 1;
    normalized.push({
      source_record_id: cleanText(row.source_record_id),
      planning_authority: cleanText(row.planning_authority),
      application_number: cleanText(row.application_number),
      received_date: receivedDate,
      year,
      development_type: normalizeDevelopmentType(row.development_type),
      development_address: cleanText(row.development_address),
      longitude,
      latitude,
      constituency: matched.constituency,
      constituency_slug: matched.constituency_slug,
      electoral_district: electoralDistrict?.electoral_district ?? "",
      electoral_district_guid:
        electoralDistrict?.electoral_district_guid ?? "",
      application_status: cleanText(row.application_status),
      application_type: cleanText(row.application_type),
      decision: cleanText(row.decision),
      decision_date: cleanText(row.decision_date),
      residential_units_reported: residentialUnits,
      marker_weight: Math.max(1, residentialUnits),
      one_off_house: cleanText(row.one_off_house) === "Yes" ? "Yes" : "No",
      application_details_url: cleanText(row.application_details_url),
      application_link_type: cleanText(row.application_link_type)
    });
  }

  await fs.mkdir(path.dirname(OUTPUT_CSV), {recursive: true});
  await fs.writeFile(OUTPUT_CSV, `\uFEFF${csvFormat(normalized)}\n`);

  const byYear = Object.fromEntries(
    Array.from(
      normalized.reduce((counts, row) => {
        counts.set(row.year, (counts.get(row.year) ?? 0) + 1);
        return counts;
      }, new Map())
    ).sort(([a], [b]) => a - b)
  );
  const byConstituency = Object.fromEntries(
    Array.from(
      normalized.reduce((counts, row) => {
        counts.set(
          row.constituency,
          (counts.get(row.constituency) ?? 0) + 1
        );
        return counts;
      }, new Map())
    ).sort(([, a], [, b]) => b - a)
  );

  console.log(
    JSON.stringify(
      {
        sourceRows: rows.length,
        outputRows: normalized.length,
        rollingWindow: {
          years: 6,
          firstIncludedYear,
          latestSourceYear
        },
        rejected,
        years: byYear,
        constituencies: byConstituency,
        output: path.relative(ROOT, OUTPUT_CSV)
      },
      null,
      2
    )
  );
}

await main();
