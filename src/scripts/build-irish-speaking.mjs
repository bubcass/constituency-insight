import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {csvFormat, csvParse} from "d3-dsv";

const TABLE = "SAP2022T3T2ED";
const API_URL = `https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/${TABLE}/JSON-stat/2.0/en`;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(scriptDir, "../data");
const mappingPath = path.join(dataDir, "demographics-age-2022.csv");
const geometryPath = path.join(dataDir, "geo/electoral-districts-2022.geojson");
const outputPath = path.join(dataDir, "irish-speaking-frequency-2022.csv");

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
const frequencyDimension = dimensions.C03757V04500;
const geographyDimension = dimensions.C04167V04938;

if (!sexDimension || !frequencyDimension || !geographyDimension) {
  throw new Error("The CSO dataset dimensions have changed");
}

const sexes = orderedCategories(sexDimension);
const frequencies = orderedCategories(frequencyDimension);
const geographies = orderedCategories(geographyDimension);
const sexByLabel = new Map(sexes.map((d) => [d.label, d]));
const frequencyByLabel = new Map(frequencies.map((d) => [d.label, d]));
const male = requiredCategory(sexByLabel, "Males");
const female = requiredCategory(sexByLabel, "Females");
const bothSexes = requiredCategory(sexByLabel, "Both Sexes");
const allSpeakers = requiredCategory(frequencyByLabel, "All Irish Speakers");
const frequencyGroups = frequencies.filter((d) => d.code !== allSpeakers.code);
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

  const raw = {};
  for (const frequency of frequencies) {
    const positions = {
      [frequencyDimension.id]: frequency.position,
      [geographyDimension.id]: geography.position,
    };
    const men = valueAt(dataset, {...positions, [sexDimension.id]: male.position});
    const women = valueAt(dataset, {...positions, [sexDimension.id]: female.position});
    const combined = valueAt(dataset, {...positions, [sexDimension.id]: bothSexes.position});
    if (men + women !== combined) {
      throw new Error(`${geography.label}: ${frequency.label} sex totals do not match`);
    }
    raw[frequency.code] = combined;
  }

  const frequencySum = frequencyGroups.reduce(
    (sum, frequency) => sum + raw[frequency.code],
    0,
  );
  if (frequencySum !== raw[allSpeakers.code]) {
    throw new Error(
      `${geography.label}: frequency groups sum to ${frequencySum}, expected ${raw[allSpeakers.code]}`,
    );
  }
  row["All Irish speakers"] = raw.ALL;
  row["Speaks Irish daily within the education system only"] = raw.DI + raw.DINO;
  row["Speaks Irish daily"] = raw.DIDO + raw.DOES;
  row["Speaks Irish weekly"] = raw.DIWO + raw.WOES;
  row["Speaks Irish less often"] = raw.DILOO + raw.LOOES;
  row["Never speaks Irish outside the education system only"] = raw.NOES;
  row["Not stated"] = raw.NS;
  return row;
});

for (const frequency of frequencies) {
  const edTotal = electoralDivisions.reduce((sum, geography) => {
    const positions = {
      [frequencyDimension.id]: frequency.position,
      [geographyDimension.id]: geography.position,
      [sexDimension.id]: bothSexes.position,
    };
    return sum + valueAt(dataset, positions);
  }, 0);
  const nationalTotal = valueAt(dataset, {
    [sexDimension.id]: bothSexes.position,
    [frequencyDimension.id]: frequency.position,
    [geographyDimension.id]: ireland.position,
  });
  if (edTotal !== nationalTotal) {
    throw new Error(
      `${frequency.label}: ED totals sum to ${edTotal}, but the CSO Ireland total is ${nationalTotal}`,
    );
  }
}

await fs.writeFile(outputPath, `${csvFormat(outputRows)}\n`, "utf8");
console.log(`Wrote ${outputRows.length.toLocaleString("en-IE")} electoral divisions to ${outputPath}`);
console.log(`Validated combined-sex speaking-frequency counts against CSO table ${TABLE}`);

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
