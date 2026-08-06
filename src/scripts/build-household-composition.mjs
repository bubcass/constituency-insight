import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {csvFormat, csvParse} from "d3-dsv";

const SIZE_TABLE = "SAP2022T5T2ED";
const TYPE_TABLE = "SAP2022T5T1ED";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(scriptDir, "../data");
const mappingPath = path.join(dataDir, "demographics-age-2022.csv");
const geometryPath = path.join(dataDir, "geo/electoral-districts-2022.geojson");
const outputPath = path.join(dataDir, "household-composition-2022.csv");

const sizeSource = sourceArgument("--size-source");
const typeSource = sourceArgument("--type-source");
const sizeDataset = sizeSource ? JSON.parse(await fs.readFile(path.resolve(sizeSource), "utf8")) : await fetchDataset(SIZE_TABLE);
const typeDataset = typeSource ? JSON.parse(await fs.readFile(path.resolve(typeSource), "utf8")) : await fetchDataset(TYPE_TABLE);

assertTable(sizeDataset, SIZE_TABLE);
assertTable(typeDataset, TYPE_TABLE);

const sizeDimensions = dimensionMap(sizeDataset);
const typeDimensions = dimensionMap(typeDataset);
const sizeStatistic = sizeDimensions.STATISTIC;
const householdSize = sizeDimensions.C03762V04511;
const sizeGeography = sizeDimensions.C04167V04938;
const typeStatistic = typeDimensions.STATISTIC;
const householdType = typeDimensions.C03774V04528;
const typeGeography = typeDimensions.C04167V04938;

if (!sizeStatistic || !householdSize || !sizeGeography || !typeStatistic || !householdType || !typeGeography) {
  throw new Error("The CSO household dataset dimensions have changed");
}

const sizeStatistics = categoryMap(sizeStatistic);
const typeStatistics = categoryMap(typeStatistic);
const privateHouseholdsBySize = requiredCategory(sizeStatistics, "Private households");
const privateHouseholdsByType = requiredCategory(typeStatistics, "Private households");
const sizeCategories = orderedCategories(householdSize);
const typeCategories = orderedCategories(householdType);
const sizeTotal = requiredCategory(new Map(sizeCategories.map((d) => [d.label, d])), "Total households");
const typeTotal = requiredCategory(new Map(typeCategories.map((d) => [d.label, d])), "Total");
const sizeParts = sizeCategories.filter((d) => d.code !== sizeTotal.code);
const typeParts = typeCategories.filter((d) => d.code !== typeTotal.code);
const sizeGeographies = orderedCategories(sizeGeography);
const typeGeographies = orderedCategories(typeGeography);
const sizeIreland = sizeGeographies.find((d) => d.code === "IE0");
const typeIreland = typeGeographies.find((d) => d.code === "IE0");
const electoralDivisions = sizeGeographies.filter((d) => d.code !== "IE0");

if (!sizeIreland || !typeIreland) throw new Error("The CSO Ireland total (IE0) is missing");
assertSameSet(
  new Set(electoralDivisions.map((d) => d.code)),
  new Set(typeGeographies.filter((d) => d.code !== "IE0").map((d) => d.code)),
  "household table geographies",
);

const mappingRows = csvParse(await fs.readFile(mappingPath, "utf8"));
const constituencyByGuid = new Map(mappingRows.map((d) => [d.ED_GUID, d["NEW CONSTITUENCY"]]));
const geometry = JSON.parse(await fs.readFile(geometryPath, "utf8"));
const geometryGuids = new Set(geometry.features.map((d) => String(d?.properties?.ED_GUID ?? "")));
const edGuids = new Set(electoralDivisions.map((d) => d.code));
assertSameSet(edGuids, new Set(constituencyByGuid.keys()), "constituency mapping");
assertSameSet(edGuids, geometryGuids, "electoral-division geometry");

const typePositionByCode = new Map(typeGeographies.map((d) => [d.code, d.position]));
const outputRows = electoralDivisions.map((geography) => {
  const row = {
    "NEW CONSTITUENCY": constituencyByGuid.get(geography.code),
    ED_GUID: geography.code,
    GEOGDESC: geography.label,
  };

  for (const category of sizeCategories) {
    row[sizeField(category.label)] = valueAt(sizeDataset, {
      [sizeStatistic.id]: privateHouseholdsBySize.position,
      [householdSize.id]: category.position,
      [sizeGeography.id]: geography.position,
    });
  }
  for (const category of typeCategories) {
    row[typeField(category.label)] = valueAt(typeDataset, {
      [typeStatistic.id]: privateHouseholdsByType.position,
      [householdType.id]: category.position,
      [typeGeography.id]: typePositionByCode.get(geography.code),
    });
  }

  const sizeSum = sizeParts.reduce((sum, category) => sum + row[sizeField(category.label)], 0);
  const typeSum = typeParts.reduce((sum, category) => sum + row[typeField(category.label)], 0);
  const sizeTotalValue = row[sizeField(sizeTotal.label)];
  const typeTotalValue = row[typeField(typeTotal.label)];
  if (sizeSum !== sizeTotalValue || typeSum !== typeTotalValue || sizeTotalValue !== typeTotalValue) {
    throw new Error(`${geography.label}: household size and type totals do not reconcile`);
  }
  if (row[sizeField("1 person households")] !== row[typeField("One person")]) {
    throw new Error(`${geography.label}: one-person household counts differ between the two tables`);
  }
  return row;
});

for (const [dataset, statistic, categoryDimension, geographyDimension, ireland, categories, field] of [
  [sizeDataset, privateHouseholdsBySize, householdSize, sizeGeography, sizeIreland, sizeCategories, sizeField],
  [typeDataset, privateHouseholdsByType, householdType, typeGeography, typeIreland, typeCategories, typeField],
]) {
  for (const category of categories) {
    const edTotal = outputRows.reduce((sum, row) => sum + row[field(category.label)], 0);
    const nationalTotal = valueAt(dataset, {
      [statistic.id]: statistic.position,
      [categoryDimension.id]: category.position,
      [geographyDimension.id]: ireland.position,
    });
    if (edTotal !== nationalTotal) {
      throw new Error(`${category.label}: ED total ${edTotal} does not match Ireland total ${nationalTotal}`);
    }
  }
}

await fs.writeFile(outputPath, `${csvFormat(outputRows)}\n`, "utf8");
console.log(`Wrote ${outputRows.length.toLocaleString("en-IE")} electoral divisions to ${outputPath}`);
console.log(`Validated household sizes and types against CSO tables ${SIZE_TABLE} and ${TYPE_TABLE}`);

function sourceArgument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  if (!value) throw new Error(`${name} requires a JSON-stat file path`);
  return value;
}

async function fetchDataset(table) {
  const url = `https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/${table}/JSON-stat/2.0/en`;
  const response = await fetch(url, {headers: {accept: "application/json"}});
  if (!response.ok) throw new Error(`CSO API request failed for ${table}: ${response.status} ${response.statusText}`);
  return response.json();
}

function assertTable(dataset, table) {
  if (dataset?.extension?.matrix !== table) {
    throw new Error(`Expected CSO table ${table}, received ${dataset?.extension?.matrix ?? "unknown"}`);
  }
}

function dimensionMap(dataset) {
  return Object.fromEntries(dataset.id.map((id, index) => [id, {id, size: dataset.size[index], ...dataset.dimension[id]}]));
}

function orderedCategories(dimension) {
  const index = dimension.category.index;
  const codes = Array.isArray(index) ? index : Object.entries(index).sort((a, b) => a[1] - b[1]).map(([code]) => code);
  return codes.map((code, position) => ({code, position, label: dimension.category.label[code]}));
}

function categoryMap(dimension) {
  return new Map(orderedCategories(dimension).map((d) => [d.label, d]));
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

function sizeField(label) {
  return `Household size — ${label}`;
}

function typeField(label) {
  return `Household type — ${label}`;
}

function assertSameSet(expected, actual, label) {
  const missing = [...expected].filter((value) => !actual.has(value));
  const extra = [...actual].filter((value) => !expected.has(value));
  if (missing.length || extra.length) {
    throw new Error(`${label} does not match the CSO EDs (${missing.length} missing, ${extra.length} extra)`);
  }
}
