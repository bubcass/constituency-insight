import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {csvFormat, csvParse} from "d3-dsv";

const TABLES = {
  ceased: "SAP2022T10T1ED",
  continuing: "SAP2022T10T2ED",
};
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(scriptDir, "../data");
const mappingPath = path.join(dataDir, "demographics-age-2022.csv");
const qualificationPath = path.join(dataDir, "education-qualification-2022.csv");
const outputPath = path.join(dataDir, "education-participation-2022.csv");

const sourceDirIndex = process.argv.indexOf("--source-dir");
const sourceDir = sourceDirIndex >= 0 ? process.argv[sourceDirIndex + 1] : null;
if (sourceDirIndex >= 0 && !sourceDir) throw new Error("--source-dir requires a directory path");

const [ceasedDataset, continuingDataset] = await Promise.all([
  readDataset(TABLES.ceased),
  readDataset(TABLES.continuing),
]);
const ceasedCube = prepareCube(ceasedDataset, TABLES.ceased, "Age Education Ceased");
const continuingCube = prepareCube(continuingDataset, TABLES.continuing, "Education Not Ceased");

assertSameSet(
  new Set(ceasedCube.geographies.map((d) => d.code)),
  new Set(continuingCube.geographies.map((d) => d.code)),
  "education-table geographies",
);

const mappingRows = csvParse(await fs.readFile(mappingPath, "utf8"));
const constituencyByGuid = new Map(mappingRows.map((d) => [d.ED_GUID, d["NEW CONSTITUENCY"]]));
const population15PlusByGuid = new Map(mappingRows.map((d) => [
  d.ED_GUID,
  Number(d.Total) - Array.from({length: 15}, (_, age) => Number(d[`Age ${age} - Total`]) || 0)
    .reduce((sum, value) => sum + value, 0),
]));
const qualificationRows = csvParse(await fs.readFile(qualificationPath, "utf8"));
const qualificationTotalByGuid = new Map(
  qualificationRows.map((d) => [d.ED_GUID, Number(d.Total)]),
);
const edGuids = new Set(ceasedCube.geographies.map((d) => d.code));
assertSameSet(edGuids, new Set(constituencyByGuid.keys()), "constituency mapping");
assertSameSet(edGuids, new Set(qualificationTotalByGuid.keys()), "qualification totals");

const ceasedTotal = requiredCategory(ceasedCube.topicByLabel, "Total");
const ceasedAges = ceasedCube.topics.filter((d) => d.code !== ceasedTotal.code);
const stillAtSchool = requiredCategory(continuingCube.topicByLabel, "Still at school or college");
const otherContinuing = requiredCategory(continuingCube.topicByLabel, "Other");

const outputRows = ceasedCube.geographies.map((geography) => {
  const continuingGeography = continuingCube.geographyByCode.get(geography.code);
  const ceasedCounts = Object.fromEntries(
    ceasedAges.map((age) => [age.label, combinedValue(ceasedCube, age, geography)]),
  );
  const educationCeased = combinedValue(ceasedCube, ceasedTotal, geography);
  const ageSum = Object.values(ceasedCounts).reduce((sum, value) => sum + value, 0);
  if (ageSum !== educationCeased) {
    throw new Error(`${geography.label}: ceased-age categories sum to ${ageSum}, expected ${educationCeased}`);
  }

  const continuingAtSchool = combinedValue(continuingCube, stillAtSchool, continuingGeography);
  const continuingOther = combinedValue(continuingCube, otherContinuing, continuingGeography);
  if (educationCeased !== qualificationTotalByGuid.get(geography.code)) {
    throw new Error(
      `${geography.label}: ceased population is ${educationCeased}, ` +
      `but the qualification table reports ${qualificationTotalByGuid.get(geography.code)}`,
    );
  }
  const population15Plus = educationCeased + continuingAtSchool + continuingOther;
  if (population15Plus !== population15PlusByGuid.get(geography.code)) {
    throw new Error(
      `${geography.label}: education-status population is ${population15Plus}, ` +
      `but the age table reports ${population15PlusByGuid.get(geography.code)}`,
    );
  }

  return {
    "NEW CONSTITUENCY": constituencyByGuid.get(geography.code),
    ED_GUID: geography.code,
    GEOGDESC: geography.label,
    "Still at school or college": continuingAtSchool,
    "Other education not ceased": continuingOther,
    "Education ceased": educationCeased,
    "Population aged 15 and over": population15Plus,
    ...ceasedCounts,
  };
});

await fs.writeFile(outputPath, `${csvFormat(outputRows)}\n`, "utf8");
console.log(`Wrote ${outputRows.length.toLocaleString("en-IE")} electoral divisions to ${outputPath}`);
console.log("Validated education-status totals against Census 2022 age and qualification totals");

async function readDataset(table) {
  if (sourceDir) {
    return JSON.parse(await fs.readFile(path.join(path.resolve(sourceDir), `${table}.json`), "utf8"));
  }
  const url = `https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/${table}/JSON-stat/2.0/en`;
  const response = await fetch(url, {headers: {accept: "application/json"}});
  if (!response.ok) throw new Error(`CSO API request failed for ${table}: ${response.status}`);
  return response.json();
}

function prepareCube(dataset, table, topicLabel) {
  if (dataset?.extension?.matrix !== table) {
    throw new Error(`Expected CSO table ${table}, received ${dataset?.extension?.matrix ?? "unknown"}`);
  }
  const dimensions = Object.fromEntries(dataset.id.map((id, index) => [
    id,
    {id, index, size: dataset.size[index], ...dataset.dimension[id]},
  ]));
  const sex = Object.values(dimensions).find((d) => d.label === "Sex");
  const topic = Object.values(dimensions).find((d) => d.label === topicLabel);
  const geography = Object.values(dimensions).find((d) => d.label === "CSO Electoral Divisions 2022");
  if (!sex || !topic || !geography) throw new Error(`${table}: expected dimensions are missing`);
  const sexes = orderedCategories(sex);
  const topics = orderedCategories(topic);
  const allGeographies = orderedCategories(geography);
  const ireland = allGeographies.find((d) => d.code === "IE0");
  const geographies = allGeographies.filter((d) => d.code !== "IE0");
  if (!ireland) throw new Error(`${table}: Ireland total is missing`);
  return {
    dataset,
    sex,
    topic,
    geography,
    male: requiredCategory(new Map(sexes.map((d) => [d.label, d])), "Males"),
    female: requiredCategory(new Map(sexes.map((d) => [d.label, d])), "Females"),
    both: requiredCategory(new Map(sexes.map((d) => [d.label, d])), "Both Sexes"),
    topics,
    topicByLabel: new Map(topics.map((d) => [d.label, d])),
    geographies,
    geographyByCode: new Map(geographies.map((d) => [d.code, d])),
  };
}

function combinedValue(cube, topic, geography) {
  const positions = {
    [cube.topic.id]: topic.position,
    [cube.geography.id]: geography.position,
  };
  const men = valueAt(cube.dataset, {...positions, [cube.sex.id]: cube.male.position});
  const women = valueAt(cube.dataset, {...positions, [cube.sex.id]: cube.female.position});
  const both = valueAt(cube.dataset, {...positions, [cube.sex.id]: cube.both.position});
  if (men + women !== both) throw new Error(`${geography.label}: sex totals do not match for ${topic.label}`);
  return both;
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
  if (!Number.isFinite(value)) throw new Error(`Missing CSO value at cube offset ${offset}`);
  return value;
}

function assertSameSet(expected, actual, label) {
  const missing = [...expected].filter((value) => !actual.has(value));
  const extra = [...actual].filter((value) => !expected.has(value));
  if (missing.length || extra.length) {
    throw new Error(`${label} does not match the CSO EDs (${missing.length} missing, ${extra.length} extra)`);
  }
}
