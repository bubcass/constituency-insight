import fs from "node:fs/promises";
import path from "node:path";
import {csvFormat, csvParse} from "d3-dsv";
import * as turf from "@turf/turf";

const ROOT = process.cwd();
const INPUT_CSV = path.join(ROOT, "src", "data", "source", "derelict-sites-harmonised.csv");
const INPUT_GEO = path.join(ROOT, "src", "data", "geo", "constituencies.json");
const OUTPUT_CSV = path.join(ROOT, "src", "data", "derived", "derelict-sites-normalized.csv");

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanConstituencyName(value) {
  return clean(value).replace(/\s*\(\d+\)\s*$/, "");
}

function buildConstituencies(geojson) {
  return (geojson?.features ?? []).map((feature) => ({
    constituency: cleanConstituencyName(feature?.properties?.ENG_NAME_VALUE),
    feature,
    bbox: turf.bbox(feature),
  })).filter((item) => item.constituency && item.feature?.geometry);
}

function assignConstituency(longitude, latitude, constituencies) {
  const point = turf.point([longitude, latitude]);
  for (const item of constituencies) {
    const [minX, minY, maxX, maxY] = item.bbox;
    if (longitude < minX || longitude > maxX || latitude < minY || latitude > maxY) continue;
    try {
      if (turf.booleanPointInPolygon(point, item.feature)) return item.constituency;
    } catch {
      // Skip invalid geometry without stopping the full data build.
    }
  }
  return "";
}

function locationCategory(value) {
  switch (clean(value)) {
    case "authority_supplied_point": return "Authority point";
    case "authority_supplied_polygon_centroid": return "Polygon centroid";
    case "authority_supplied_itm_transformed":
    case "authority_supplied_grid_transformed": return "Transformed grid reference";
    default: return "Other authority location";
  }
}

async function main() {
  const [csvText, geoText] = await Promise.all([
    fs.readFile(INPUT_CSV, "utf8"),
    fs.readFile(INPUT_GEO, "utf8"),
  ]);
  const sourceRows = csvParse(csvText.replace(/^\uFEFF/, ""));
  const constituencies = buildConstituencies(JSON.parse(geoText));
  const output = [];
  let invalidCoordinates = 0;
  let outsideConstituencies = 0;

  for (const row of sourceRows) {
    if (!clean(row.latitude) || !clean(row.longitude)) {
      invalidCoordinates += 1;
      continue;
    }
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      invalidCoordinates += 1;
      continue;
    }
    const constituency = assignConstituency(longitude, latitude, constituencies);
    if (!constituency) {
      outsideConstituencies += 1;
      continue;
    }
    output.push({
      record_id: clean(row.record_id),
      constituency,
      local_authority: clean(row.local_authority),
      register_reference: clean(row.register_reference),
      address_or_description: clean(row.address_or_description),
      description: clean(row.description),
      eircode: clean(row.eircode),
      latitude,
      longitude,
      site_count: 1,
      location_category: locationCategory(row.location_source),
      location_source: clean(row.location_source),
      location_precision: clean(row.location_precision),
      source_x: clean(row.source_x),
      source_y: clean(row.source_y),
      source_coordinate_system: clean(row.source_coordinate_system),
      source_geometry_type: clean(row.source_geometry_type),
      date_entered: clean(row.date_entered),
      valuation: clean(row.valuation),
      source_url: clean(row.source_url),
      source_date: clean(row.source_date),
      retrieved_date: clean(row.retrieved_date),
      source_format: clean(row.source_format),
      acquisition_method: clean(row.acquisition_method),
      extraction_quality: clean(row.extraction_quality),
    });
  }

  await fs.mkdir(path.dirname(OUTPUT_CSV), {recursive: true});
  await fs.writeFile(OUTPUT_CSV, `${csvFormat(output)}\n`, "utf8");
  console.log(JSON.stringify({sourceRows: sourceRows.length, mappedRows: output.length, invalidCoordinates, outsideConstituencies}, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
