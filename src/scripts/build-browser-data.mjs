import {createHash} from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {autoType, csvParse} from "d3-dsv";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(SCRIPT_DIR, "../data");
const OUTPUT_DIR = path.join(DATA_DIR, "derived/browser");

const DATASETS = [
  dataset("demographics-age-2022.csv", ["people", "education", "transport"]),
  dataset("principal-economic-status-2022.csv", ["people", "employment"]),
  dataset("irish-speaking-frequency-2022.csv", ["people", "education"]),
  dataset("disability-2022.csv", ["people"]),
  dataset("carers-2022.csv", ["people"]),
  dataset("household-composition-2022.csv", ["people"]),
  dataset("deprivation-index-2022.csv", ["people"]),
  dataset("education-qualification-2022.csv", ["education"]),
  dataset("education-participation-2022.csv", ["education"]),
  dataset("employment-industry-2022.csv", ["employment"]),
  dataset("employment-occupation-2022.csv", ["employment"]),
  dataset("working-from-home-2022.csv", ["employment"]),
  dataset("household-income-2022.csv", ["employment"]),
  dataset("housing-tenure-2022.csv", ["housing"]),
  dataset("housing-stock-2022.csv", ["housing"]),
  dataset("adults-living-with-parents-2022.csv", ["housing"]),
  dataset("renewable-energy-households-2022.csv", ["housing"]),
  dataset("derived/derelict-sites-normalized.csv", ["points"], {
    strings: [
      "record_id", "register_reference", "eircode", "date_entered", "source_date",
      "retrieved_date", "source_url",
    ],
  }),
  dataset("derived/health-services-normalized.csv", ["points"], {
    strings: [
      "service_id", "name", "address", "eircode", "telephone", "email", "website",
      "electoral_district_guid",
    ],
  }),
  dataset("derived/road-accidents-normalized.csv", ["road"], {
    strings: [
      "incident_id", "date", "time_band", "constituency", "constituency_slug",
      "electoral_district", "electoral_district_guid", "incident_type",
    ],
  }),
  dataset("derived/planning-applications-normalized.csv", ["planning"], {
    strings: [
      "source_record_id", "planning_authority", "application_number", "received_date",
      "development_type", "development_address", "constituency", "constituency_slug",
      "electoral_district", "electoral_district_guid", "application_status",
      "application_type", "decision", "decision_date", "application_details_url",
      "application_link_type",
    ],
  }),
];

const options = parseArgs(process.argv.slice(2));
const selected = options.groups.size
  ? DATASETS.filter((item) => item.groups.some((group) => options.groups.has(group)))
  : DATASETS;

if (!selected.length) throw new Error("No browser datasets matched the selected groups");
if (!options.check) await fs.mkdir(OUTPUT_DIR, {recursive: true});

const stale = [];
const manifest = [];
for (const item of selected) {
  const sourcePath = path.join(DATA_DIR, item.source);
  const sourceText = await fs.readFile(sourcePath, "utf8");
  const rawRows = csvParse(sourceText.replace(/^\uFEFF/, ""));
  const missingStrings = item.strings.filter((column) => !rawRows.columns.includes(column));
  if (missingStrings.length) {
    throw new Error(`${item.source} is missing configured string columns: ${missingStrings.join(", ")}`);
  }
  const parsed = rawRows.map((raw) => {
    const row = autoType({...raw});
    for (const column of item.strings) row[column] = raw[column];
    return row;
  });
  Object.defineProperty(parsed, "columns", {value: rawRows.columns});
  assertBrowserSafe(item.source, parsed);

  const table = {
    columns: parsed.columns,
    rows: parsed.map((row) => parsed.columns.map((column) => row[column])),
  };
  const outputText = `${JSON.stringify(table)}\n`;
  const outputPath = path.join(OUTPUT_DIR, item.output);
  manifest.push({
    source: item.source,
    output: `derived/browser/${item.output}`,
    rows: parsed.length,
    columns: parsed.columns,
    source_sha256: sha256(sourceText),
    output_sha256: sha256(outputText),
  });

  if (options.check) {
    const current = await fs.readFile(outputPath, "utf8").catch((error) => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });
    if (current !== outputText) stale.push(item.output);
  } else {
    await fs.writeFile(outputPath, outputText, "utf8");
  }
}

if (options.check && stale.length) {
  throw new Error(`Browser data is missing or stale:\n- ${stale.join("\n- ")}`);
}

if (!options.check && !options.groups.size) {
  await fs.writeFile(
    path.join(OUTPUT_DIR, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

const rowCount = manifest.reduce((sum, item) => sum + item.rows, 0);
console.log(
  `${options.check ? "Verified" : "Wrote"} ${selected.length} browser datasets ` +
  `containing ${rowCount.toLocaleString("en-IE")} rows.`,
);

function dataset(source, groups, {strings = []} = {}) {
  return {
    source,
    groups,
    strings,
    output: path.basename(source).replace(/\.csv$/i, ".json"),
  };
}

function assertBrowserSafe(name, rows) {
  if (!rows.length) throw new Error(`${name} contains no data rows`);
  if (!rows.columns?.length) throw new Error(`${name} contains no header columns`);

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    for (const [column, value] of Object.entries(rows[rowIndex])) {
      if (value instanceof Date) {
        throw new Error(
          `${name} row ${rowIndex + 2} column ${column} contains a date; ` +
          "add an explicit date serialization rule before publishing it as JSON",
        );
      }
      if (typeof value === "number" && !Number.isFinite(value)) {
        throw new Error(
          `${name} row ${rowIndex + 2} column ${column} contains a non-finite number`,
        );
      }
    }
  }
}

function parseArgs(args) {
  const groups = new Set();
  let check = false;
  for (const argument of args) {
    if (argument === "--check") check = true;
    else if (argument.startsWith("--group=")) {
      for (const group of argument.slice("--group=".length).split(",")) groups.add(group);
    } else throw new Error(`Unknown option: ${argument}`);
  }
  return {check, groups};
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
