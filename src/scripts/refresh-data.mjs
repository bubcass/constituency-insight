import fs from "node:fs/promises";
import path from "node:path";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");

const STATIC_INPUTS = [
  "src/data/demographics-age-2022.csv",
  "src/data/geo/constituencies.json",
  "src/data/geo/electoral-districts-2022.geojson",
  "src/data/geo/electoral-district-validity-fallbacks.geojson",
  "src/data/data_road_accidents.csv",
  "src/data/data_sports_funding.csv",
  "src/data/source/derelict-sites-harmonised.csv",
  "src/data/source/gps-hse-ireland.csv",
  "src/data/source/health-centres-hse-ireland.csv",
  "src/data/source/hospitals-hse-ireland.csv",
  "src/data/source/hp-deprivation-index-scores-2022.csv",
  "src/data/source/irish-planning-applications-map-feed.csv.gz",
  "src/data/source/pharmacies-hse-ireland.csv",
];

const TASKS = [
  task("census", "Education qualifications", "src/scripts/build-education-qualification.mjs"),
  task("census", "Education participation", "src/scripts/build-education-participation.mjs"),
  task("census", "Irish-speaking frequency", "src/scripts/build-irish-speaking.mjs"),
  task("census", "Principal economic status", "src/scripts/build-principal-economic-status.mjs"),
  task("census", "Disability", "src/scripts/build-disability.mjs"),
  task("census", "Carers", "src/scripts/build-carers.mjs"),
  task("census", "Household composition", "src/scripts/build-household-composition.mjs"),
  task("census", "Renewable-energy households", "src/scripts/build-renewable-energy-households.mjs"),
  task("census", "Adults living with parents", "src/scripts/build-adults-living-with-parents.mjs"),
  task("census", "Housing tenure", "src/scripts/build-housing-tenure.mjs"),
  task("census", "Housing stock", "src/scripts/build-housing-stock.mjs"),
  task("census", "Employment by industry", "src/scripts/build-employment-industry.mjs"),
  task("census", "Employment by occupation", "src/scripts/build-employment-occupation.mjs"),
  task("census", "Working from home", "src/scripts/build-working-from-home.mjs"),
  task("census", "Household income", "src/scripts/build-household-income.mjs"),
  task("census", "Transport commuting", "src/scripts/build-transport-commuting.mjs"),

  task("current", "Parliamentary activity", "src/scripts/build-parliamentary-activity.mjs"),
  task("current", "Derelict-site contributions", "src/scripts/build-derelict-contributions.mjs"),
  task("current", "Transport access", "src/scripts/build-transport-access.mjs"),

  task("derived", "Deprivation index", "src/scripts/build-deprivation-index.mjs"),
  task("derived", "Sports-funding enrichment", "src/scripts/spotlights/build-sports-funding.mjs"),
  task("derived", "Sports-funding waterfall", "src/scripts/spotlights/build-sports-funding-waterfall.mjs", [
    "src/data/derived/sports-funding-enriched.json",
    "src/data/derived/waterfall-segments.json",
  ]),
  task("derived", "Road-safety normalization", "src/scripts/spotlights/build-road-safety.mjs"),
  task("derived", "Derelict-site normalization", "src/scripts/spotlights/build-derelict-sites.mjs"),
  task("derived", "Health-service normalization", "src/scripts/spotlights/build-health-services.mjs"),
  task("derived", "Planning-application normalization", "src/scripts/spotlights/build-planning-applications.mjs"),
];

const GROUPS = new Set(["census", "current", "derived"]);
const options = parseArgs(process.argv.slice(2));

if (options.list) {
  for (const item of TASKS) console.log(`${item.group.padEnd(10)} ${item.label}`);
  process.exit(0);
}

await validateStaticInputs();

const selectedTasks = options.groups.size
  ? TASKS.filter((item) => options.groups.has(item.group))
  : TASKS;

if (!selectedTasks.length) throw new Error("No data-refresh tasks were selected");

const startedAt = Date.now();
console.log(
  `Refreshing ${selectedTasks.length} data products` +
  `${options.groups.size ? ` in ${[...options.groups].join(", ")}` : ""}.`,
);

for (let index = 0; index < selectedTasks.length; index += 1) {
  const item = selectedTasks[index];
  const taskStartedAt = Date.now();
  console.log(`\n[${index + 1}/${selectedTasks.length}] ${item.label}`);
  await runNode(item.script, item.args);
  console.log(`Completed in ${formatDuration(Date.now() - taskStartedAt)}`);
}

console.log("\n[finalize] Browser-ready JSON");
await runNode("src/scripts/build-browser-data.mjs");

console.log("\n[check] Cross-dataset consistency");
await runNode("src/scripts/audit-metric-consistency.mjs");
console.log(`\nData refresh completed in ${formatDuration(Date.now() - startedAt)}.`);

function task(group, label, script, args = []) {
  return {group, label, script, args};
}

function parseArgs(args) {
  const groups = new Set();
  let list = false;

  for (const argument of args) {
    if (argument === "--list") {
      list = true;
      continue;
    }
    if (argument.startsWith("--group=")) {
      for (const group of argument.slice("--group=".length).split(",")) {
        if (!GROUPS.has(group)) {
          throw new Error(`Unknown refresh group: ${group}. Expected one of ${[...GROUPS].join(", ")}`);
        }
        groups.add(group);
      }
      continue;
    }
    throw new Error(`Unknown option: ${argument}`);
  }

  return {groups, list};
}

async function validateStaticInputs() {
  const missing = [];
  const empty = [];

  for (const relativePath of STATIC_INPUTS) {
    try {
      const stats = await fs.stat(path.join(ROOT, relativePath));
      if (!stats.isFile() || stats.size === 0) empty.push(relativePath);
    } catch (error) {
      if (error?.code === "ENOENT") missing.push(relativePath);
      else throw error;
    }
  }

  if (missing.length || empty.length) {
    const details = [
      missing.length ? `Missing:\n- ${missing.join("\n- ")}` : "",
      empty.length ? `Empty:\n- ${empty.join("\n- ")}` : "",
    ].filter(Boolean).join("\n");
    throw new Error(`Static data prerequisites are not ready.\n${details}`);
  }

  console.log(`Validated ${STATIC_INPUTS.length} versioned static inputs.`);
}

function runNode(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, script), ...args], {
      cwd: ROOT,
      env: process.env,
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`));
    });
  });
}

function formatDuration(milliseconds) {
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
