import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {csvFormat, csvParse} from "d3-dsv";

const TABLE = "SAP2022T8T1ED";
const API_URL = `https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/${TABLE}/JSON-stat/2.0/en`;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(scriptDir, "../data");
const mappingPath = path.join(dataDir, "demographics-age-2022.csv");
const geometryPath = path.join(dataDir, "geo/electoral-districts-2022.geojson");
const outputPath = path.join(dataDir, "principal-economic-status-2022.csv");

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
const sexDimension = dimensions.C03738V04487;
const economicStatusDimension = dimensions.C03742V04491;
const geographyDimension = dimensions.C04167V04938;

if (!sexDimension || !economicStatusDimension || !geographyDimension) {
  throw new Error("The CSO dataset dimensions have changed");
}

const sexes = orderedCategories(sexDimension);
const economicStatuses = orderedCategories(economicStatusDimension);
const geographies = orderedCategories(geographyDimension);
const sexByLabel = new Map(sexes.map((d) => [d.label, d]));
const economicStatusByLabel = new Map(economicStatuses.map((d) => [d.label, d]));
const male = requiredCategory(sexByLabel, "Males");
const female = requiredCategory(sexByLabel, "Females");
const bothSexes = requiredCategory(sexByLabel, "Both Sexes");
const totalEconomicStatus = requiredCategory(economicStatusByLabel, "Total");
const economicStatusGroups = economicStatuses.filter((d) => d.code !== totalEconomicStatus.code);
const ireland = geographies.find((d) => d.code === "IE0");
const electoralDivisions = geographies.filter((d) => d.code !== "IE0");

if (!ireland) throw new Error("The CSO Ireland total (IE0) is missing");

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

const outputRows = electoralDivisions.map((geography) => {
  const row = {
    "NEW CONSTITUENCY": constituencyByGuid.get(geography.code),
    ED_GUID: geography.code,
    GEOGDESC: geography.label,
  };

  for (const economicStatus of economicStatuses) {
    const positions = {
      [economicStatusDimension.id]: economicStatus.position,
      [geographyDimension.id]: geography.position,
    };
    const men = valueAt(dataset, {...positions, [sexDimension.id]: male.position});
    const women = valueAt(dataset, {...positions, [sexDimension.id]: female.position});
    const combined = valueAt(dataset, {...positions, [sexDimension.id]: bothSexes.position});
    if (men + women !== combined) {
      throw new Error(`${geography.label}: ${economicStatus.label} sex totals do not match`);
    }
    row[economicStatus.label] = combined;
  }

  const statusSum = economicStatusGroups.reduce(
    (sum, economicStatus) => sum + row[economicStatus.label],
    0,
  );
  if (statusSum !== row[totalEconomicStatus.label]) {
    throw new Error(
      `${geography.label}: economic-status groups sum to ${statusSum}, expected ${row[totalEconomicStatus.label]}`,
    );
  }
  return row;
});

for (const economicStatus of economicStatuses) {
  const edTotal = outputRows.reduce((sum, row) => sum + row[economicStatus.label], 0);
  const nationalTotal = valueAt(dataset, {
    [sexDimension.id]: bothSexes.position,
    [economicStatusDimension.id]: economicStatus.position,
    [geographyDimension.id]: ireland.position,
  });
  if (edTotal !== nationalTotal) {
    throw new Error(
      `${economicStatus.label}: ED totals sum to ${edTotal}, but the CSO Ireland total is ${nationalTotal}`,
    );
  }
}

await fs.writeFile(outputPath, `${csvFormat(outputRows)}\n`, "utf8");
console.log(`Wrote ${outputRows.length.toLocaleString("en-IE")} electoral divisions to ${outputPath}`);
console.log(`Validated combined-sex principal-economic-status counts against CSO table ${TABLE}`);

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
