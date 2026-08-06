import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {csvParse} from "d3-dsv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = path.join(root, "src/data");
const failures = [];
let checks = 0;

function csv(name) {
  return csvParse(fs.readFileSync(path.join(dataDir, name), "utf8"));
}

function number(row, field) {
  const value = Number(row[field]);
  return Number.isFinite(value) ? value : 0;
}

function identity(row) {
  return `${row.GEOGDESC || "Unknown area"} (${row.ED_GUID || "no GUID"})`;
}

function check(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
}

function equal(actual, expected, message, tolerance = 0) {
  check(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`);
}

function sum(row, fields) {
  return fields.reduce((total, field) => total + number(row, field), 0);
}

function reconcileRows(name, totalField, componentFields) {
  for (const row of csv(name)) {
    equal(sum(row, componentFields), number(row, totalField), `${name} — ${identity(row)} — ${totalField}`);
  }
}

const ages = csv("demographics-age-2022.csv");
const ageBases = ages.columns
  .filter((field) => field.endsWith(" - Total") && field !== "Total")
  .map((field) => field.slice(0, -" - Total".length));
for (const row of ages) {
  for (const age of ageBases) {
    equal(
      number(row, `${age} - Males`) + number(row, `${age} - Females`),
      number(row, `${age} - Total`),
      `demographics-age-2022.csv — ${identity(row)} — ${age} sex total`,
    );
  }
  equal(sum(row, ageBases.map((age) => `${age} - Total`)), number(row, "Total"), `demographics-age-2022.csv — ${identity(row)} — all ages`);
  equal(number(row, "Total - Males") + number(row, "Total - Females"), number(row, "Total"), `demographics-age-2022.csv — ${identity(row)} — total by sex`);
}

const qualificationFields = csv("education-qualification-2022.csv").columns.filter(
  (field) => !["NEW CONSTITUENCY", "ED_GUID", "GEOGDESC", "Total"].includes(field),
);
reconcileRows("education-qualification-2022.csv", "Total", qualificationFields);

const ceasedAgeFields = ["Age under 15", "Age 15", "Age 16", "Age 17", "Age 18", "Age 19", "Age 20", "Age 21 and over", "Not stated"];
for (const row of csv("education-participation-2022.csv")) {
  equal(sum(row, ceasedAgeFields), number(row, "Education ceased"), `education-participation-2022.csv — ${identity(row)} — ceased-age groups`);
  equal(
    sum(row, ["Still at school or college", "Other education not ceased", "Education ceased"]),
    number(row, "Population aged 15 and over"),
    `education-participation-2022.csv — ${identity(row)} — population aged 15+`,
  );
}

const irishFields = [
  "Speaks Irish daily within the education system only",
  "Speaks Irish daily",
  "Speaks Irish weekly",
  "Speaks Irish less often",
  "Never speaks Irish outside the education system only",
  "Not stated",
];
reconcileRows("irish-speaking-frequency-2022.csv", "All Irish speakers", irishFields);

const ageByGuid = new Map(ages.map((row) => [row.ED_GUID, row]));
for (const row of csv("irish-speaking-frequency-2022.csv")) {
  const ageRow = ageByGuid.get(row.ED_GUID);
  check(Boolean(ageRow), `Irish-language row has no matching age row — ${identity(row)}`);
  if (!ageRow) continue;
  const populationAgedThreePlus = number(ageRow, "Total") - sum(ageRow, ["Age 0 - Total", "Age 1 - Total", "Age 2 - Total"]);
  check(number(row, "All Irish speakers") <= populationAgedThreePlus, `Irish speakers exceed residents aged 3+ — ${identity(row)}`);
}

const economicFields = csv("principal-economic-status-2022.csv").columns.filter(
  (field) => !["NEW CONSTITUENCY", "ED_GUID", "GEOGDESC", "Total"].includes(field),
);
reconcileRows("principal-economic-status-2022.csv", "Total", economicFields);

reconcileRows("renewable-energy-households-2022.csv", "All households", [
  "Households with at least one renewable energy source",
  "Households with no renewable energy sources",
  "Renewable energy source not stated",
]);

const householdSizeFields = [
  "Household size — 1 person households", "Household size — 2 person households",
  "Household size — 3 person households", "Household size — 4 person households",
  "Household size — 5 person households", "Household size — 6 person households",
  "Household size — 7 person households", "Household size — 8 or more persons households",
];
const householdTypeFields = [
  "Household type — One person", "Household type — Married couple", "Household type — Cohabiting couple",
  "Household type — Married couple with children", "Household type — Cohabiting couple with children",
  "Household type — One parent family (father) with children", "Household type — One parent family (mother) with children",
  "Household type — Couple and others", "Household type — Couple with children and others",
  "Household type — One parent family (father) with children and others",
  "Household type — One parent family (mother) with children and others", "Household type — Two or more family units",
  "Household type — Non-family households and relations", "Household type — Two or more non-related persons",
];
for (const row of csv("household-composition-2022.csv")) {
  equal(sum(row, householdSizeFields), number(row, "Household size — Total households"), `household-composition-2022.csv — ${identity(row)} — household sizes`);
  equal(sum(row, householdTypeFields), number(row, "Household type — Total"), `household-composition-2022.csv — ${identity(row)} — household types`);
  equal(number(row, "Household size — Total households"), number(row, "Household type — Total"), `household-composition-2022.csv — ${identity(row)} — table totals`);
  equal(number(row, "Household size — 1 person households"), number(row, "Household type — One person"), `household-composition-2022.csv — ${identity(row)} — one-person households`);
}
reconcileRows("working-from-home-2022.csv", "All working persons", [
  "Persons who work from home",
  "Persons who never work from home",
  "Work From Home status - Not stated",
]);

for (const [name, categories] of [
  ["employment-industry-2022.csv", ["Agriculture, forestry and fishing", "Building and construction", "Manufacturing industries", "Commerce and trade", "Transport and communications", "Public administration", "Professional services", "Other"]],
  ["employment-occupation-2022.csv", ["Managers, Directors and Senior Officials", "Professional Occupations", "Associate Professional and Technical Occupations", "Administrative and Secretarial Occupations", "Skilled Trades Occupations", "Caring, Leisure and Other Service Occupations", "Sales and Customer Service Occupations", "Process, Plant and Machine Operatives", "Elementary Occupations", "Not stated"]],
]) {
  for (const row of csv(name)) {
    for (const category of categories) {
      equal(number(row, `${category} (Males)`) + number(row, `${category} (Females)`), number(row, `${category} (Both Sexes)`), `${name} — ${identity(row)} — ${category} by sex`);
    }
    for (const sex of ["Males", "Females", "Both Sexes"]) {
      equal(sum(row, categories.map((category) => `${category} (${sex})`)), number(row, `Total (${sex})`), `${name} — ${identity(row)} — ${sex} category total`);
    }
  }
}

const tenureCategories = [
  "Owned with mortgage or loan", "Owned outright", "Rented from private landlord",
  "Rented from Local Authority", "Rented from voluntary/co-operative housing body",
  "Occupied free of rent", "Not stated",
];
for (const row of csv("housing-tenure-2022.csv")) {
  for (const unit of ["Households", "Persons"]) {
    equal(sum(row, tenureCategories.map((category) => `${category} (${unit})`)), number(row, `Total (${unit})`), `housing-tenure-2022.csv — ${identity(row)} — ${unit}`);
  }
}

reconcileRows("housing-stock-2022.csv", "Total housing stock", [
  "Occupied by usual residents", "Occupied by visitors only", "Residents temporarily absent",
  "Vacant house or flat", "Holiday home",
]);
for (const row of csv("housing-stock-2022.csv")) {
  const derived = number(row, "Total housing stock") ? number(row, "Vacant house or flat") / number(row, "Total housing stock") * 100 : 0;
  equal(derived, number(row, "Vacancy rate"), `housing-stock-2022.csv — ${identity(row)} — vacancy rate`, 0.051);
}

for (const row of csv("adults-living-with-parents-2022.csv")) {
  check(number(row, "Adults living with parents") <= number(row, "Adults aged 18+"), `Adults living with parents exceed adults aged 18+ — ${identity(row)}`);
}

const transport = JSON.parse(fs.readFileSync(path.join(dataDir, "transport-commuting-2022.json"), "utf8"));
for (const row of transport.records ?? []) {
  for (const key of ["means", "departure", "journey"]) {
    equal(
      (row[key] ?? []).reduce((total, value) => total + (Number(value) || 0), 0) + (Number(row[`${key}NotStated`]) || 0),
      Number(row[`${key}Total`]) || 0,
      `transport-commuting-2022.json — ${row.edName} (${row.edGuid}) — ${key} total`,
    );
  }
}

const roadUsers = ["cyclist_count", "driver_count", "e_scooter_other_count", "motorcyclist_count", "passenger_count", "pedestrian_count"];
for (const row of csv("derived/road-accidents-normalized.csv")) {
  equal(sum(row, roadUsers), number(row, "casualty_count"), `road-accidents-normalized.csv — incident ${row.incident_id} — road-user total`);
  equal(
    sum(row, ["fatality_count", "serious_injury_count", "non_serious_injury_count"]),
    number(row, "casualty_count"),
    `road-accidents-normalized.csv — incident ${row.incident_id} — injury-severity total`,
  );
}

const fundingRows = JSON.parse(fs.readFileSync(path.join(dataDir, "derived/sports-funding-enriched.json"), "utf8"));
const fundingByAreaYear = new Map();
for (const row of fundingRows) {
  const key = `${row.__constituency}\u0000${row.__year}`;
  fundingByAreaYear.set(key, (fundingByAreaYear.get(key) || 0) + (Number(row.__amount) || 0));
}
for (const record of JSON.parse(fs.readFileSync(path.join(dataDir, "derived/waterfall-segments.json"), "utf8"))) {
  const segmentTotal = (record.segments ?? []).reduce((total, segment) => total + (Number(segment.value) || 0), 0);
  const shareTotal = (record.segments ?? []).reduce((total, segment) => total + (Number(segment.share) || 0), 0);
  equal(segmentTotal, Number(record.total) || 0, `waterfall-segments.json — ${record.constituency}, ${record.period} — segment total`);
  equal(segmentTotal, fundingByAreaYear.get(`${record.constituency}\u0000${record.period}`) || 0, `sports funding — ${record.constituency}, ${record.period} — source total`);
  equal(shareTotal, segmentTotal > 0 ? 1 : 0, `waterfall-segments.json — ${record.constituency}, ${record.period} — shares`, 1e-9);
}

const sourceFiles = fs.readdirSync(path.join(root, "src"), {recursive: true})
  .filter((name) => /\.(?:js|md|mjs)$/.test(name) && !String(name).startsWith("data/"));
for (const relative of sourceFiles) {
  if (relative === "scripts/audit-metric-consistency.mjs") continue;
  const content = fs.readFileSync(path.join(root, "src", relative), "utf8");
  for (const match of content.matchAll(/d3\.format\("([^"]*%)"\)/g)) {
    check(match[1] === ".1%", `${relative} uses d3 percentage format ${match[1]}; use .1%`);
  }
}

if (failures.length) {
  console.error(`Metric consistency audit failed (${failures.length} of ${checks} checks):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Metric consistency audit passed: ${checks.toLocaleString("en-IE")} checks across the published metric datasets.`);
}
