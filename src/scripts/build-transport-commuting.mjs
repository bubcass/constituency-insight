import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {csvParse} from "d3-dsv";

const TABLES = Object.freeze({
  means: "SAP2022T11T1ED",
  departure: "SAP2022T11T2ED",
  journey: "SAP2022T11T3ED"
});
const API_ROOT = "https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(SCRIPT_DIR, "../data");
const MAPPING_PATH = path.join(DATA_DIR, "demographics-age-2022.csv");
const OUTPUT_PATH = path.join(DATA_DIR, "transport-commuting-2022.json");

const datasets = Object.fromEntries(await Promise.all(
  Object.entries(TABLES).map(async ([key, table]) => [key, await loadDataset(table, argumentValue(`--${key}-source`))])
));

for (const [key, table] of Object.entries(TABLES)) {
  const received = datasets[key]?.extension?.matrix;
  if (received !== table) throw new Error(`Expected CSO table ${table}, received ${received ?? "unknown"}`);
}

const meansCube = describeCube(datasets.means);
const departureCube = describeCube(datasets.departure);
const journeyCube = describeCube(datasets.journey);
const geographyId = "C04167V04938";
const geographyDimensions = [meansCube, departureCube, journeyCube].map((cube) => cube.dimensions[geographyId]);

if (geographyDimensions.some((dimension) => !dimension)) {
  throw new Error("The CSO electoral-division dimension has changed");
}

const geographyLists = geographyDimensions.map(orderedCategories);
assertSameOrderedCodes(geographyLists[0], geographyLists[1], "departure-time geography");
assertSameOrderedCodes(geographyLists[0], geographyLists[2], "journey-time geography");

const geographies = geographyLists[0];
const electoralDivisions = geographies.filter((category) => category.code !== "IE0");
const ireland = geographies.find((category) => category.code === "IE0");
if (!ireland) throw new Error("The CSO Ireland total (IE0) is missing");

const meansDimension = requiredDimension(meansCube, "C03767V04516");
const statisticDimension = requiredDimension(meansCube, "STATISTIC");
const totalMeansStatistic = orderedCategories(statisticDimension)
  .find((category) => category.label.endsWith("(total)"));
if (!totalMeansStatistic) throw new Error("The combined means-of-travel statistic is missing");

const departureDimension = requiredDimension(departureCube, "C03744V04493");
const journeyDimension = requiredDimension(journeyCube, "C03766V04515");
const meansCategories = substantiveCategories(meansDimension);
const departureCategories = substantiveCategories(departureDimension);
const journeyCategories = substantiveCategories(journeyDimension);
const meansNotStated = categoryByCode(meansDimension, "NS");
const departureNotStated = categoryByCode(departureDimension, "NS");
const journeyNotStated = categoryByCode(journeyDimension, "NS");
const meansTotal = categoryByCode(meansDimension, "T");
const departureTotal = categoryByCode(departureDimension, "T");
const journeyTotal = categoryByCode(journeyDimension, "T");

const mappingRows = csvParse(await fs.readFile(MAPPING_PATH, "utf8"));
const mappingByGuid = new Map(mappingRows.map((row) => [row.ED_GUID, row]));
assertSameSet(new Set(electoralDivisions.map((category) => category.code)), new Set(mappingByGuid.keys()), "constituency mapping");

function valuesFor(geography) {
  const meansPositions = {
    [statisticDimension.id]: totalMeansStatistic.position,
    [geographyId]: geography.position
  };
  const departurePositions = {[geographyId]: geography.position};
  const journeyPositions = {[geographyId]: geography.position};
  return {
    means: meansCategories.map((category) => valueAt(datasets.means, {...meansPositions, [meansDimension.id]: category.position})),
    meansNotStated: valueAt(datasets.means, {...meansPositions, [meansDimension.id]: meansNotStated.position}),
    meansTotal: valueAt(datasets.means, {...meansPositions, [meansDimension.id]: meansTotal.position}),
    departure: departureCategories.map((category) => valueAt(datasets.departure, {...departurePositions, [departureDimension.id]: category.position})),
    departureNotStated: valueAt(datasets.departure, {...departurePositions, [departureDimension.id]: departureNotStated.position}),
    departureTotal: valueAt(datasets.departure, {...departurePositions, [departureDimension.id]: departureTotal.position}),
    journey: journeyCategories.map((category) => valueAt(datasets.journey, {...journeyPositions, [journeyDimension.id]: category.position})),
    journeyNotStated: valueAt(datasets.journey, {...journeyPositions, [journeyDimension.id]: journeyNotStated.position}),
    journeyTotal: valueAt(datasets.journey, {...journeyPositions, [journeyDimension.id]: journeyTotal.position})
  };
}

function validateRecord(record, label) {
  validateTotal(record.means, record.meansNotStated, record.meansTotal, `${label} means of travel`);
  validateTotal(record.departure, record.departureNotStated, record.departureTotal, `${label} departure time`);
  validateTotal(record.journey, record.journeyNotStated, record.journeyTotal, `${label} journey time`);
}

const records = electoralDivisions.map((geography) => {
  const mapping = mappingByGuid.get(geography.code);
  const record = {
    constituency: mapping["NEW CONSTITUENCY"],
    edGuid: geography.code,
    edName: mapping.GEOGDESC || geography.label,
    ...valuesFor(geography)
  };
  validateRecord(record, geography.label);
  return record;
});

const national = valuesFor(ireland);
validateRecord(national, "Ireland");
const allElectoralDivisions = records.reduce((aggregate, record) => ({
  means: addArrays(aggregate.means, record.means),
  meansNotStated: aggregate.meansNotStated + record.meansNotStated,
  meansTotal: aggregate.meansTotal + record.meansTotal,
  departure: addArrays(aggregate.departure, record.departure),
  departureNotStated: aggregate.departureNotStated + record.departureNotStated,
  departureTotal: aggregate.departureTotal + record.departureTotal,
  journey: addArrays(aggregate.journey, record.journey),
  journeyNotStated: aggregate.journeyNotStated + record.journeyNotStated,
  journeyTotal: aggregate.journeyTotal + record.journeyTotal
}), {
  means: [], meansNotStated: 0, meansTotal: 0,
  departure: [], departureNotStated: 0, departureTotal: 0,
  journey: [], journeyNotStated: 0, journeyTotal: 0
});
assertSameProfile(allElectoralDivisions, national, "ED aggregation and CSO Ireland total");

const output = {
  generatedAt: new Date().toISOString(),
  censusYear: 2022,
  sources: TABLES,
  categories: {
    means: meansCategories.map(({code, label}) => ({code, label})),
    departure: departureCategories.map(({code, label}) => ({code, label})),
    journey: journeyCategories.map(({code, label}) => ({code, label}))
  },
  national,
  records
};

await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(output)}\n`, "utf8");
console.log(`Wrote Census commuting profiles for ${records.length.toLocaleString("en-IE")} electoral divisions to ${OUTPUT_PATH}`);
console.log(`National stated means-of-travel base: ${sum(national.means).toLocaleString("en-IE")}`);

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : null;
  if (index >= 0 && !value) throw new Error(`${name} requires a JSON-stat file path`);
  return value;
}

async function loadDataset(table, sourcePath) {
  if (sourcePath) return JSON.parse(await fs.readFile(path.resolve(sourcePath), "utf8"));
  const response = await fetch(`${API_ROOT}/${table}/JSON-stat/2.0/en`, {headers: {accept: "application/json"}});
  if (!response.ok) throw new Error(`CSO API request for ${table} failed: ${response.status} ${response.statusText}`);
  return response.json();
}

function describeCube(dataset) {
  return {
    dimensions: Object.fromEntries(dataset.id.map((id, index) => [id, {id, index, size: dataset.size[index], ...dataset.dimension[id]}]))
  };
}

function requiredDimension(cube, id) {
  const dimension = cube.dimensions[id];
  if (!dimension) throw new Error(`Required CSO dimension is missing: ${id}`);
  return dimension;
}

function orderedCategories(dimension) {
  const index = dimension.category.index;
  const codes = Array.isArray(index)
    ? index
    : Object.entries(index).sort((a, b) => a[1] - b[1]).map(([code]) => code);
  return codes.map((code, position) => ({code, position, label: dimension.category.label[code]}));
}

function categoryByCode(dimension, code) {
  const category = orderedCategories(dimension).find((item) => item.code === code);
  if (!category) throw new Error(`Required category is missing from ${dimension.id}: ${code}`);
  return category;
}

function substantiveCategories(dimension) {
  return orderedCategories(dimension).filter((category) => category.code !== "NS" && category.code !== "T");
}

function valueAt(dataset, positions) {
  let offset = 0;
  for (let index = 0; index < dataset.id.length; index += 1) {
    offset = offset * dataset.size[index] + (positions[dataset.id[index]] ?? 0);
  }
  const value = Array.isArray(dataset.value) ? dataset.value[offset] : dataset.value[String(offset)];
  if (!Number.isFinite(value)) throw new Error(`Missing or non-numeric CSO value at cube offset ${offset}`);
  return value;
}

function validateTotal(values, notStated, total, label) {
  const calculated = sum(values) + notStated;
  if (calculated !== total) throw new Error(`${label} categories sum to ${calculated}, expected ${total}`);
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function addArrays(left, right) {
  const length = Math.max(left.length, right.length);
  return Array.from({length}, (_, index) => (left[index] ?? 0) + (right[index] ?? 0));
}

function assertSameProfile(actual, expected, label) {
  for (const key of ["means", "departure", "journey"]) {
    if (actual[key].length !== expected[key].length || actual[key].some((value, index) => value !== expected[key][index])) {
      throw new Error(`${label}: ${key} categories differ`);
    }
    for (const suffix of ["NotStated", "Total"]) {
      if (actual[`${key}${suffix}`] !== expected[`${key}${suffix}`]) {
        throw new Error(`${label}: ${key}${suffix} differs`);
      }
    }
  }
}

function assertSameOrderedCodes(expected, actual, label) {
  if (expected.length !== actual.length || expected.some((category, index) => category.code !== actual[index].code)) {
    throw new Error(`${label} does not match the means-of-travel geography`);
  }
}

function assertSameSet(expected, actual, label) {
  const missing = [...expected].filter((value) => !actual.has(value));
  const extra = [...actual].filter((value) => !expected.has(value));
  if (missing.length || extra.length) {
    throw new Error(`${label} does not match the CSO EDs (${missing.length} missing, ${extra.length} extra)`);
  }
}
