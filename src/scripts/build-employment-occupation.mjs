import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {csvFormat, csvParse} from "d3-dsv";

const TABLE = "SAP2022T13T1ED";
const API_URL = `https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/${TABLE}/JSON-stat/2.0/en`;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(scriptDir, "../data");
const mappingPath = path.join(dataDir, "demographics-age-2022.csv");
const outputPath = path.join(dataDir, "employment-occupation-2022.csv");

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

const dimensions = Object.fromEntries(dataset.id.map((id, index) => [
  id,
  {id, index, size: dataset.size[index], ...dataset.dimension[id]}
]));
const sexDimension = dimensions.C03738V04487;
const occupationDimension = dimensions.C03773V04522;
const geographyDimension = dimensions.C04167V04938;

if (!sexDimension || !occupationDimension || !geographyDimension) {
  throw new Error("The CSO dataset dimensions have changed");
}

const sexes = orderedCategories(sexDimension);
const occupations = orderedCategories(occupationDimension);
const geographies = orderedCategories(geographyDimension);
const occupationByLabel = new Map(occupations.map((d) => [d.label, d]));
const totalOccupation = requiredCategory(occupationByLabel, "Total");
const detailOccupations = occupations.filter((d) => d.code !== totalOccupation.code);
const electoralDivisions = geographies.filter((d) => d.code !== "IE0");
const ireland = geographies.find((d) => d.code === "IE0");

if (!ireland) throw new Error("The CSO Ireland total (IE0) is missing");

const mappingRows = csvParse(await fs.readFile(mappingPath, "utf8"));
const mappingByGuid = new Map(mappingRows.map((d) => [d.ED_GUID, d]));
assertSameSet(
  new Set(electoralDivisions.map((d) => d.code)),
  new Set(mappingByGuid.keys()),
  "constituency mapping"
);

const outputRows = electoralDivisions.map((geography) => {
  const mapping = mappingByGuid.get(geography.code);
  const row = {
    "NEW CONSTITUENCY": mapping["NEW CONSTITUENCY"],
    ED_GUID: geography.code,
    GEOGDESC: geography.label
  };

  for (const occupation of occupations) {
    for (const sex of sexes) {
      row[fieldName(occupation.label, sex.label)] = valueAt(dataset, {
        [sexDimension.id]: sex.position,
        [occupationDimension.id]: occupation.position,
        [geographyDimension.id]: geography.position
      });
    }
  }

  for (const sex of sexes) {
    const detailSum = detailOccupations.reduce(
      (sum, occupation) => sum + row[fieldName(occupation.label, sex.label)],
      0
    );
    const expected = row[fieldName(totalOccupation.label, sex.label)];
    if (detailSum !== expected) {
      throw new Error(`${geography.label}: ${sex.label} occupations sum to ${detailSum}, expected ${expected}`);
    }
  }
  return row;
});

for (const occupation of occupations) {
  for (const sex of sexes) {
    const edTotal = outputRows.reduce((sum, row) => sum + row[fieldName(occupation.label, sex.label)], 0);
    const nationalTotal = valueAt(dataset, {
      [sexDimension.id]: sex.position,
      [occupationDimension.id]: occupation.position,
      [geographyDimension.id]: ireland.position
    });
    if (edTotal !== nationalTotal) {
      throw new Error(`${occupation.label}, ${sex.label}: EDs sum to ${edTotal}, expected ${nationalTotal}`);
    }
  }
}

await fs.writeFile(outputPath, `${csvFormat(outputRows)}\n`, "utf8");
console.log(`Wrote ${outputRows.length.toLocaleString("en-IE")} electoral divisions to ${outputPath}`);
console.log("Validated occupation and sex totals against the CSO Ireland totals");

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

function fieldName(occupation, sex) {
  return `${occupation} (${sex})`;
}

function assertSameSet(expected, actual, label) {
  const missing = [...expected].filter((value) => !actual.has(value));
  const extra = [...actual].filter((value) => !expected.has(value));
  if (missing.length || extra.length) {
    throw new Error(`${label} does not match the CSO EDs (${missing.length} missing, ${extra.length} extra)`);
  }
}
