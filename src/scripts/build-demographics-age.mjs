import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {csvFormat, csvParse} from "d3-dsv";

const TABLE = "SAP2022T1T1ED";
const API_URL = `https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/${TABLE}/JSON-stat/2.0/en`;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(SCRIPT_DIR, "../data");
const MAPPING_PATH = path.join(DATA_DIR, "source/electoral-district-constituency-2024.csv");
const OUTPUT_PATH = path.join(DATA_DIR, "demographics-age-2022.csv");

const options = parseArgs(process.argv.slice(2));
const dataset = options.source
  ? JSON.parse(await fs.readFile(options.source, "utf8"))
  : await fetchDataset();
if (dataset?.extension?.matrix !== TABLE) {
  throw new Error(`Expected CSO table ${TABLE}, received ${dataset?.extension?.matrix ?? "unknown"}`);
}

const dimensions = Object.fromEntries(
  dataset.id.map((id, index) => [id, {id, size: dataset.size[index], ...dataset.dimension[id]}]),
);
const ageDimension = dimensions.C03737V04485;
const sexDimension = dimensions.C03738V04487;
const geographyDimension = dimensions.C04167V04938;
if (!ageDimension || !sexDimension || !geographyDimension) {
  throw new Error("The CSO age-profile dataset dimensions have changed");
}

const ages = orderedCategories(ageDimension);
const sexes = orderedCategories(sexDimension);
const geographies = orderedCategories(geographyDimension);
const electoralDivisions = geographies.filter((item) => item.code !== "IE0");
const ireland = geographies.find((item) => item.code === "IE0");
if (!ireland) throw new Error("The CSO Ireland total is missing");

const mappingRows = csvParse(await fs.readFile(MAPPING_PATH, "utf8"));
const mappingByGuid = new Map(mappingRows.map((row) => [row.ED_GUID, row["NEW CONSTITUENCY"]]));
assertSameSet(new Set(electoralDivisions.map((item) => item.code)), new Set(mappingByGuid.keys()), "constituency mapping");
const geographyByGuid = new Map(electoralDivisions.map((item) => [item.code, item]));

const rows = mappingRows.map((mapping) => {
  const geography = geographyByGuid.get(mapping.ED_GUID);
  if (!geography) throw new Error(`No CSO age-profile geography for ${mapping.ED_GUID}`);
  const row = {
    "NEW CONSTITUENCY": mapping["NEW CONSTITUENCY"],
    ED_GUID: geography.code,
    GEOGID: geography.code,
    GEOGDESC: mapping.GEOGDESC,
  };
  for (const sex of sexes) {
    for (const age of ages) row[outputFieldName(outputAgeLabel(age.label), sex.label)] = valueAt(dataset, {
      [ageDimension.id]: age.position,
      [sexDimension.id]: sex.position,
      [geographyDimension.id]: geography.position,
    });
  }
  return row;
});

for (const row of rows) {
  for (const age of ages) {
    const ageLabel = outputAgeLabel(age.label);
    const male = Number(row[outputFieldName(ageLabel, "Males")]);
    const female = Number(row[outputFieldName(ageLabel, "Females")]);
    const total = Number(row[outputFieldName(ageLabel, "Both Sexes")]);
    if (male + female !== total) throw new Error(`${row.GEOGDESC}: ${age.label} sex total does not reconcile`);
  }
}

const totalAge = ages.find((age) => age.label === "Total");
const bothSexes = sexes.find((sex) => sex.label === "Both Sexes");
if (!totalAge || !bothSexes) throw new Error("The CSO age-profile totals are missing");
const nationalTotal = valueAt(dataset, {
  [ageDimension.id]: totalAge.position,
  [sexDimension.id]: bothSexes.position,
  [geographyDimension.id]: ireland.position,
});
const edTotal = rows.reduce((sum, row) => sum + Number(row.Total), 0);
if (edTotal !== nationalTotal) throw new Error(`ED total ${edTotal} does not match Ireland total ${nationalTotal}`);

await fs.writeFile(OUTPUT_PATH, `${csvFormat(rows)}\n`, "utf8");
console.log(`Retrieved and transformed ${TABLE} into ${path.relative(process.cwd(), OUTPUT_PATH)} (${rows.length.toLocaleString("en-IE")} EDs)`);

function parseArgs(args) {
  if (!args.length) return {source: null};
  if (args.length === 2 && args[0] === "--source") return {source: path.resolve(args[1])};
  throw new Error("Usage: node src/scripts/build-demographics-age.mjs [--source <JSON-stat fixture path>]");
}

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

function valueAt(data, positions) {
  let offset = 0;
  for (let index = 0; index < data.id.length; index += 1) {
    offset = offset * data.size[index] + (positions[data.id[index]] ?? 0);
  }
  const value = Array.isArray(data.value) ? data.value[offset] : data.value[String(offset)];
  if (!Number.isFinite(value)) throw new Error(`Missing or non-numeric CSO value at cube offset ${offset}`);
  return value;
}

function outputSexLabel(label) {
  return label === "Both Sexes" ? "Total" : label;
}

function outputFieldName(ageLabel, sexLabel) {
  return ageLabel === "Total" && sexLabel === "Both Sexes"
    ? "Total"
    : `${ageLabel} - ${outputSexLabel(sexLabel)}`;
}

function outputAgeLabel(label) {
  return label.replace(/^(Age \d+)-(\d+)$/, "$1 - $2");
}

function assertSameSet(expected, actual, label) {
  const missing = [...expected].filter((value) => !actual.has(value));
  const extra = [...actual].filter((value) => !expected.has(value));
  if (missing.length || extra.length) {
    throw new Error(`${label} does not match the CSO EDs (${missing.length} missing, ${extra.length} extra)`);
  }
}
