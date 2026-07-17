import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {csvFormat, csvParse} from "d3-dsv";

const TABLE = "SAP2022T6T3ED";
const API_URL = `https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/${TABLE}/JSON-stat/2.0/en`;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(SCRIPT_DIR, "../data");
const MAPPING_PATH = path.join(DATA_DIR, "demographics-age-2022.csv");
const GEOMETRY_PATH = path.join(DATA_DIR, "geo/electoral-districts-2022.geojson");
const OUTPUT_PATH = path.join(DATA_DIR, "housing-tenure-2022.csv");

const args = process.argv.slice(2);
const sourceIndex = args.indexOf("--source");
const sourcePath = sourceIndex >= 0 ? args[sourceIndex + 1] : null;

if (sourceIndex >= 0 && !sourcePath) {
  throw new Error("--source requires a JSON-stat file path");
}

const dataset = sourcePath
  ? JSON.parse(await fs.readFile(path.resolve(sourcePath), "utf8"))
  : await fetchDataset();

if (dataset?.extension?.matrix !== TABLE) {
  throw new Error(`Expected CSO table ${TABLE}, received ${dataset?.extension?.matrix ?? "unknown"}`);
}

const dimensions = Object.fromEntries(
  dataset.id.map((id, index) => [
    id,
    {id, index, size: dataset.size[index], ...dataset.dimension[id]},
  ]),
);
const statisticDimension = dimensions.STATISTIC;
const occupancyDimension = dimensions.C03761V04510;
const geographyDimension = dimensions.C04167V04938;

if (!statisticDimension || !occupancyDimension || !geographyDimension) {
  throw new Error("The CSO dataset dimensions have changed");
}

const statistics = orderedCategories(statisticDimension);
const occupancies = orderedCategories(occupancyDimension);
const geographies = orderedCategories(geographyDimension);
const statisticByLabel = new Map(statistics.map((d) => [d.label, d]));
const occupancyByLabel = new Map(occupancies.map((d) => [d.label, d]));
const households = requiredCategory(statisticByLabel, "Permanent private households");
const persons = requiredCategory(
  statisticByLabel,
  "Number of persons in permanent private households",
);
const totalOccupancy = requiredCategory(occupancyByLabel, "Total");
const tenureOccupancies = occupancies.filter((d) => d.code !== totalOccupancy.code);
const ireland = geographies.find((d) => d.code === "IE0");
const electoralDivisions = geographies.filter((d) => d.code !== "IE0");

if (!ireland) throw new Error("The CSO Ireland total (IE0) is missing");

const mappingRows = csvParse(await fs.readFile(MAPPING_PATH, "utf8"));
const constituencyByGuid = new Map(
  mappingRows.map((d) => [d.ED_GUID, d["NEW CONSTITUENCY"]]),
);
const geometry = JSON.parse(await fs.readFile(GEOMETRY_PATH, "utf8"));
const geometryGuids = new Set(
  geometry.features.map((d) => String(d?.properties?.ED_GUID ?? "")),
);
const edGuids = new Set(electoralDivisions.map((d) => d.code));

assertSameSet(edGuids, new Set(constituencyByGuid.keys()), "constituency mapping");
assertSameSet(edGuids, geometryGuids, "electoral-division geometry");

const outputRows = electoralDivisions.map((geography) => {
  const row = {
    "NEW CONSTITUENCY": constituencyByGuid.get(geography.code),
    ED_GUID: geography.code,
    GEOGDESC: geography.label,
  };

  for (const occupancy of occupancies) {
    row[fieldName(occupancy.label, "Households")] = valueAt(dataset, {
      [statisticDimension.id]: households.position,
      [occupancyDimension.id]: occupancy.position,
      [geographyDimension.id]: geography.position,
    });
    row[fieldName(occupancy.label, "Persons")] = valueAt(dataset, {
      [statisticDimension.id]: persons.position,
      [occupancyDimension.id]: occupancy.position,
      [geographyDimension.id]: geography.position,
    });
  }

  for (const [statistic, suffix] of [
    [households, "Households"],
    [persons, "Persons"],
  ]) {
    const tenureSum = tenureOccupancies.reduce(
      (sum, occupancy) => sum + row[fieldName(occupancy.label, suffix)],
      0,
    );
    const expected = row[fieldName(totalOccupancy.label, suffix)];
    if (tenureSum !== expected) {
      throw new Error(
        `${geography.label}: ${statistic.label} tenures sum to ${tenureSum}, expected ${expected}`,
      );
    }
  }

  return row;
});

for (const statistic of [households, persons]) {
  for (const occupancy of occupancies) {
    const suffix = statistic.code === households.code ? "Households" : "Persons";
    const edTotal = outputRows.reduce(
      (sum, row) => sum + row[fieldName(occupancy.label, suffix)],
      0,
    );
    const nationalTotal = valueAt(dataset, {
      [statisticDimension.id]: statistic.position,
      [occupancyDimension.id]: occupancy.position,
      [geographyDimension.id]: ireland.position,
    });
    if (edTotal !== nationalTotal) {
      throw new Error(
        `${statistic.label}, ${occupancy.label}: EDs sum to ${edTotal}, Ireland total is ${nationalTotal}`,
      );
    }
  }
}

await fs.writeFile(OUTPUT_PATH, `${csvFormat(outputRows)}\n`, "utf8");
console.log(
  `Wrote ${outputRows.length.toLocaleString("en-IE")} electoral divisions to ${OUTPUT_PATH}`,
);
console.log(
  `Validated permanent private households against the CSO Ireland total: ${valueAt(dataset, {
    [statisticDimension.id]: households.position,
    [occupancyDimension.id]: totalOccupancy.position,
    [geographyDimension.id]: ireland.position,
  }).toLocaleString("en-IE")}`,
);

async function fetchDataset() {
  const response = await fetch(API_URL, {headers: {accept: "application/json"}});
  if (!response.ok) {
    throw new Error(`CSO API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function orderedCategories(dimension) {
  const index = dimension.category.index;
  const codes = Array.isArray(index)
    ? index
    : Object.entries(index)
        .sort((a, b) => a[1] - b[1])
        .map(([code]) => code);
  return codes.map((code, position) => ({
    code,
    position,
    label: dimension.category.label[code],
  }));
}

function requiredCategory(categories, label) {
  const category = categories.get(label);
  if (!category) throw new Error(`Required category is missing: ${label}`);
  return category;
}

function valueAt(data, positions) {
  let offset = 0;
  for (let index = 0; index < data.id.length; index += 1) {
    offset = offset * data.size[index] + (positions[data.id[index]] ?? 0);
  }
  const value = Array.isArray(data.value) ? data.value[offset] : data.value[String(offset)];
  if (!Number.isFinite(value)) {
    throw new Error(`Missing or non-numeric CSO value at cube offset ${offset}`);
  }
  return value;
}

function fieldName(occupancy, statistic) {
  return `${occupancy} (${statistic})`;
}

function assertSameSet(expected, actual, label) {
  const missing = [...expected].filter((value) => !actual.has(value));
  const extra = [...actual].filter((value) => !expected.has(value));
  if (missing.length || extra.length) {
    throw new Error(
      `${label} does not match the CSO EDs (${missing.length} missing, ${extra.length} extra)`,
    );
  }
}
