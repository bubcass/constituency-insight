import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {csvFormat, csvParse} from "d3-dsv";

const TABLE = "F3055";
const API_URL = `https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/${TABLE}/JSON-stat/2.0/en`;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(SCRIPT_DIR, "../data");
const MAPPING_PATH = path.join(DATA_DIR, "demographics-age-2022.csv");
const OUTPUT_PATH = path.join(DATA_DIR, "adults-living-with-parents-2022.csv");

const sourceIndex = process.argv.indexOf("--source");
const sourcePath = sourceIndex >= 0 ? process.argv[sourceIndex + 1] : null;
if (sourceIndex >= 0 && !sourcePath) throw new Error("--source requires a JSON-stat file path");

const dataset = sourcePath
  ? JSON.parse(await fs.readFile(path.resolve(sourcePath), "utf8"))
  : await fetchDataset();
if (dataset?.extension?.matrix !== TABLE) {
  throw new Error(`Expected CSO table ${TABLE}, received ${dataset?.extension?.matrix ?? "unknown"}`);
}

const dimensions = Object.fromEntries(dataset.id.map((id, index) => [
  id,
  {id, size: dataset.size[index], ...dataset.dimension[id]},
]));
const statistic = dimensions.STATISTIC;
const sex = dimensions.C02199V02655;
const geography = dimensions.C04167V04938;
if (!statistic || !sex || !geography) throw new Error("The CSO dataset dimensions have changed");

const statistics = categoryMap(statistic);
const sexes = categoryMap(sex);
const geographies = orderedCategories(geography).filter((place) => place.code !== "IE0");
const adultPopulation = requiredCategory(statistics, "Population aged 18 years and over");
const livingWithParents = requiredCategory(statistics, "Population aged 18 years and over living with their parents");
const percentage = requiredCategory(statistics, "Percentage of population aged 18 years and over living with their parents");
const bothSexes = requiredCategory(sexes, "Both sexes");

const mappingRows = csvParse(await fs.readFile(MAPPING_PATH, "utf8"));
const constituencyByGuid = new Map(mappingRows.map((row) => [row.ED_GUID, row["NEW CONSTITUENCY"]]));
assertSameSet(new Set(geographies.map((place) => place.code)), new Set(constituencyByGuid.keys()));

const outputRows = geographies.map((place) => {
  const population = valueAt(dataset, adultPopulation, bothSexes, place);
  const count = valueAt(dataset, livingWithParents, bothSexes, place);
  const publishedRate = valueAt(dataset, percentage, bothSexes, place);
  const derivedRate = population ? count / population * 100 : 0;
  if (Math.abs(derivedRate - publishedRate) > 0.011) {
    throw new Error(`${place.label}: derived percentage does not match F3055`);
  }
  return {
    "NEW CONSTITUENCY": constituencyByGuid.get(place.code),
    ED_GUID: place.code,
    GEOGDESC: place.label,
    "Adults aged 18+": population,
    "Adults living with parents": count,
  };
});

await fs.writeFile(OUTPUT_PATH, `${csvFormat(outputRows)}\n`, "utf8");
console.log(`Wrote ${outputRows.length.toLocaleString("en-IE")} electoral divisions to ${OUTPUT_PATH}`);

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

function categoryMap(dimension) {
  return new Map(orderedCategories(dimension).map((item) => [item.label, item]));
}

function requiredCategory(categories, label) {
  const item = categories.get(label);
  if (!item) throw new Error(`Required category is missing: ${label}`);
  return item;
}

function valueAt(data, measure, selectedSex, place) {
  let offset = 0;
  for (let index = 0; index < data.id.length; index += 1) {
    const id = data.id[index];
    const position = id === "STATISTIC"
      ? measure.position
      : id === "C02199V02655"
        ? selectedSex.position
        : id === "C04167V04938"
          ? place.position
          : 0;
    offset = offset * data.size[index] + position;
  }
  const value = Array.isArray(data.value) ? data.value[offset] : data.value[String(offset)];
  if (!Number.isFinite(value)) throw new Error(`Missing or non-numeric CSO value at cube offset ${offset}`);
  return value;
}

function assertSameSet(expected, actual) {
  const missing = [...expected].filter((value) => !actual.has(value));
  const extra = [...actual].filter((value) => !expected.has(value));
  if (missing.length || extra.length) {
    throw new Error(`Constituency mapping does not match F3055 (${missing.length} missing, ${extra.length} extra)`);
  }
}
