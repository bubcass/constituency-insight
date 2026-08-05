import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {csvFormat, csvParse} from "d3-dsv";

const TABLE = "GPIIA01";
const API_URL = `https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/${TABLE}/JSON-stat/2.0/en`;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(scriptDir, "../data");
const mappingPath = path.join(dataDir, "demographics-age-2022.csv");
const geometryPath = path.join(dataDir, "geo/electoral-districts-2022.geojson");
const outputPath = path.join(dataDir, "household-income-2022.csv");

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
const geographyDimension = dimensions.C04167V04938;

if (!statisticDimension || !geographyDimension) {
  throw new Error("The CSO dataset dimensions have changed");
}

const statistics = orderedCategories(statisticDimension);
const geographies = orderedCategories(geographyDimension);
const statisticsByLabel = new Map(statistics.map((d) => [d.label, d]));
const medianGross = requiredCategory(statisticsByLabel, "Median Gross Household Income");
const meanGross = requiredCategory(statisticsByLabel, "Mean Gross Household Income");
const ireland = geographies.find((d) => d.code === "IE0");
const electoralDivisions = geographies.filter((d) => d.code !== "IE0");

if (!ireland) throw new Error("The CSO Ireland value (IE0) is missing");

const irelandMedianGross = valueAt(dataset, {
  [statisticDimension.id]: medianGross.position,
  [geographyDimension.id]: ireland.position,
});
const irelandMeanGross = valueAt(dataset, {
  [statisticDimension.id]: meanGross.position,
  [geographyDimension.id]: ireland.position,
});

const mappingRows = csvParse(await fs.readFile(mappingPath, "utf8"));
const constituencyByGuid = new Map(
  mappingRows.map((d) => [d.ED_GUID, d["NEW CONSTITUENCY"]]),
);
const geometry = JSON.parse(await fs.readFile(geometryPath, "utf8"));
const geometryGuids = new Set(
  geometry.features.map((d) => String(d?.properties?.ED_GUID ?? "")),
);
const edGuids = new Set(electoralDivisions.map((d) => d.code));

assertSameSet(edGuids, new Set(constituencyByGuid.keys()), "constituency mapping");
assertSameSet(edGuids, geometryGuids, "electoral-division geometry");

const outputRows = electoralDivisions.map((geography) => ({
  "NEW CONSTITUENCY": constituencyByGuid.get(geography.code),
  ED_GUID: geography.code,
  GEOGDESC: geography.label,
  "Median Gross Household Income": valueAt(dataset, {
    [statisticDimension.id]: medianGross.position,
    [geographyDimension.id]: geography.position,
  }),
  "Mean Gross Household Income": valueAt(dataset, {
    [statisticDimension.id]: meanGross.position,
    [geographyDimension.id]: geography.position,
  }),
  "Ireland Median Gross Household Income": irelandMedianGross,
  "Ireland Mean Gross Household Income": irelandMeanGross,
}));

for (const row of outputRows) {
  if (row["Median Gross Household Income"] <= 0 || row["Mean Gross Household Income"] <= 0) {
    throw new Error(`${row.GEOGDESC}: household-income values must be positive`);
  }
}

await fs.writeFile(outputPath, `${csvFormat(outputRows)}\n`, "utf8");
console.log(`Wrote ${outputRows.length.toLocaleString("en-IE")} electoral divisions to ${outputPath}`);
console.log(`Validated gross household-income values against CSO table ${TABLE}`);
console.log(`Ireland: median €${irelandMedianGross.toLocaleString("en-IE")}; mean €${irelandMeanGross.toLocaleString("en-IE")}`);

async function fetchDataset() {
  const response = await fetch(API_URL, {headers: {accept: "application/json"}});
  if (!response.ok) throw new Error(`CSO API request failed: ${response.status} ${response.statusText}`);
  return response.json();
}

function orderedCategories(dimension) {
  const index = dimension.category.index;
  const codes = Array.isArray(index)
    ? index
    : Object.entries(index).sort((a, b) => a[1] - b[1]).map(([code]) => code);
  return codes.map((code, position) => ({code, position, label: dimension.category.label[code]}));
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
  if (!Number.isFinite(value)) throw new Error(`Missing or non-numeric CSO value at cube offset ${offset}`);
  return value;
}

function assertSameSet(expected, actual, label) {
  const missing = [...expected].filter((value) => !actual.has(value));
  const extra = [...actual].filter((value) => !expected.has(value));
  if (missing.length || extra.length) {
    throw new Error(`${label} does not match the CSO EDs (${missing.length} missing, ${extra.length} extra)`);
  }
}
