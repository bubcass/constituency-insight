import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {csvFormat, csvParse} from "d3-dsv";

const TABLE = "F2095";
const API_URL = `https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/${TABLE}/JSON-stat/2.0/en`;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(SCRIPT_DIR, "../data");
const MAPPING_PATH = path.join(DATA_DIR, "demographics-age-2022.csv");
const GEOMETRY_PATH = path.join(DATA_DIR, "geo/electoral-districts-2022.geojson");
const OUTPUT_PATH = path.join(DATA_DIR, "housing-stock-2022.csv");

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
const stockDimension = dimensions.C02758V03328;
const geographyDimension = dimensions.C04167V04938;

if (!stockDimension || !geographyDimension) {
  throw new Error("The CSO dataset dimensions have changed");
}

const stockCategories = orderedCategories(stockDimension);
const geographies = orderedCategories(geographyDimension);
const stockByLabel = new Map(stockCategories.map((d) => [d.label, d]));
const totalStock = requiredCategory(stockByLabel, "Total housing stock");
const vacancyRate = requiredCategory(stockByLabel, "Vacancy rate");
const vacant = requiredCategory(stockByLabel, "Unoccupied - Vacant house & Flat");
const composition = [
  [requiredCategory(stockByLabel, "Occupied by - Usual resident(s) of the household"), "Occupied by usual residents"],
  [requiredCategory(stockByLabel, "Occupied by - Visitors only"), "Occupied by visitors only"],
  [requiredCategory(stockByLabel, "Unoccupied - Residents temporarily absent"), "Residents temporarily absent"],
  [vacant, "Vacant house or flat"],
  [requiredCategory(stockByLabel, "Unoccupied - Holiday Home"), "Holiday home"],
];
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
  const total = valueAt(dataset, stockDimension, geographyDimension, totalStock, geography);
  const row = {
    "NEW CONSTITUENCY": constituencyByGuid.get(geography.code),
    ED_GUID: geography.code,
    GEOGDESC: geography.label,
    "Total housing stock": total,
  };

  for (const [category, field] of composition) {
    row[field] = valueAt(dataset, stockDimension, geographyDimension, category, geography);
  }
  row["Vacancy rate"] = valueAt(
    dataset,
    stockDimension,
    geographyDimension,
    vacancyRate,
    geography,
  );

  const compositionTotal = composition.reduce((sum, [, field]) => sum + row[field], 0);
  if (compositionTotal !== total) {
    throw new Error(
      `${geography.label}: housing-stock categories sum to ${compositionTotal}, expected ${total}`,
    );
  }

  const derivedRate = total ? (row["Vacant house or flat"] / total) * 100 : 0;
  if (Math.abs(derivedRate - row["Vacancy rate"]) > 0.051) {
    throw new Error(
      `${geography.label}: derived vacancy rate ${derivedRate} does not match ${row["Vacancy rate"]}`,
    );
  }

  return row;
});

for (const [category, field] of [[totalStock, "Total housing stock"], ...composition]) {
  const edTotal = outputRows.reduce((sum, row) => sum + row[field], 0);
  const nationalTotal = valueAt(
    dataset,
    stockDimension,
    geographyDimension,
    category,
    ireland,
  );
  if (edTotal !== nationalTotal) {
    throw new Error(`${field}: EDs sum to ${edTotal}, Ireland total is ${nationalTotal}`);
  }
}

const nationalTotal = valueAt(
  dataset,
  stockDimension,
  geographyDimension,
  totalStock,
  ireland,
);
const nationalVacant = valueAt(
  dataset,
  stockDimension,
  geographyDimension,
  vacant,
  ireland,
);
const publishedNationalRate = valueAt(
  dataset,
  stockDimension,
  geographyDimension,
  vacancyRate,
  ireland,
);
const derivedNationalRate = (nationalVacant / nationalTotal) * 100;
if (Math.abs(derivedNationalRate - publishedNationalRate) > 0.051) {
  throw new Error("The published Ireland vacancy rate does not reconcile with the stock counts");
}

await fs.writeFile(OUTPUT_PATH, `${csvFormat(outputRows)}\n`, "utf8");
console.log(
  `Wrote ${outputRows.length.toLocaleString("en-IE")} electoral divisions to ${OUTPUT_PATH}`,
);
console.log(
  `Validated ${nationalTotal.toLocaleString("en-IE")} homes and a ${publishedNationalRate.toFixed(1)}% national vacancy rate`,
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

function valueAt(data, stock, geography, category, place) {
  let offset = 0;
  for (let index = 0; index < data.id.length; index += 1) {
    const id = data.id[index];
    const position = id === stock.id
      ? category.position
      : id === geography.id
        ? place.position
        : 0;
    offset = offset * data.size[index] + position;
  }
  const value = Array.isArray(data.value) ? data.value[offset] : data.value[String(offset)];
  if (!Number.isFinite(value)) {
    throw new Error(`Missing or non-numeric CSO value at cube offset ${offset}`);
  }
  return value;
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
