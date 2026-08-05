import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {csvFormat, csvParse} from "d3-dsv";

const TABLE = "SAP2022T6T10ED";
const API_URL = `https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/${TABLE}/JSON-stat/2.0/en`;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(scriptDir, "../data");
const mappingPath = path.join(dataDir, "demographics-age-2022.csv");
const geometryPath = path.join(dataDir, "geo/electoral-districts-2022.geojson");
const outputPath = path.join(dataDir, "renewable-energy-households-2022.csv");

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
const renewableDimension = dimensions.C04083V04845;
const geographyDimension = dimensions.C04167V04938;

if (!renewableDimension || !geographyDimension) {
  throw new Error("The CSO dataset dimensions have changed");
}

const renewableCategories = orderedCategories(renewableDimension);
const geographies = orderedCategories(geographyDimension);
const renewableByLabel = new Map(renewableCategories.map((d) => [d.label, d]));
const noRenewable = requiredCategory(renewableByLabel, "No renewable energy sources");
const notStated = requiredCategory(renewableByLabel, "Renewable energy source not stated");
const hasRenewable = requiredCategory(renewableByLabel, "Has at least one renewable energy source of any type");
const allHouseholds = requiredCategory(renewableByLabel, "All households");
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
  const positions = {[geographyDimension.id]: geography.position};
  const without = valueAt(dataset, {...positions, [renewableDimension.id]: noRenewable.position});
  const unstated = valueAt(dataset, {...positions, [renewableDimension.id]: notStated.position});
  const withRenewable = valueAt(dataset, {...positions, [renewableDimension.id]: hasRenewable.position});
  const total = valueAt(dataset, {...positions, [renewableDimension.id]: allHouseholds.position});

  if (without + unstated + withRenewable !== total) {
    throw new Error(`${geography.label}: renewable-energy categories do not sum to all households`);
  }

  return {
    "NEW CONSTITUENCY": constituencyByGuid.get(geography.code),
    ED_GUID: geography.code,
    GEOGDESC: geography.label,
    "Households with at least one renewable energy source": withRenewable,
    "Households with no renewable energy sources": without,
    "Renewable energy source not stated": unstated,
    "All households": total,
  };
});

for (const category of [noRenewable, notStated, hasRenewable, allHouseholds]) {
  const edTotal = outputRows.reduce((sum, row) => {
    const field = category === noRenewable
      ? "Households with no renewable energy sources"
      : category === notStated
        ? "Renewable energy source not stated"
        : category === hasRenewable
          ? "Households with at least one renewable energy source"
          : "All households";
    return sum + row[field];
  }, 0);
  const nationalTotal = valueAt(dataset, {
    [renewableDimension.id]: category.position,
    [geographyDimension.id]: ireland.position,
  });
  if (edTotal !== nationalTotal) {
    throw new Error(`${category.label}: ED total ${edTotal} does not match Ireland total ${nationalTotal}`);
  }
}

await fs.writeFile(outputPath, `${csvFormat(outputRows)}\n`, "utf8");
console.log(`Wrote ${outputRows.length.toLocaleString("en-IE")} electoral divisions to ${outputPath}`);
console.log(`Validated household renewable-energy counts against CSO table ${TABLE}`);

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
