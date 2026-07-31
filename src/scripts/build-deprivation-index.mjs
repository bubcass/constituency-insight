import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {csvFormat, csvParse} from "d3-dsv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(scriptDir, "../data");
const defaultSourcePath = path.join(dataDir, "source/hp-deprivation-index-scores-2022.csv");
const geometryPath = path.join(dataDir, "geo/electoral-districts-2022.geojson");
const mappingPath = path.join(dataDir, "demographics-age-2022.csv");
const outputPath = path.join(dataDir, "deprivation-index-2022.csv");

const args = process.argv.slice(2);
const sourceIndex = args.indexOf("--source");
const sourcePath = sourceIndex >= 0 ? args[sourceIndex + 1] : defaultSourcePath;

if (!sourcePath) throw new Error("--source requires a CSV file path");

const sourceRows = csvParse(await fs.readFile(path.resolve(sourcePath), "utf8"));
const geometry = JSON.parse(await fs.readFile(geometryPath, "utf8"));
const mappingRows = csvParse(await fs.readFile(mappingPath, "utf8"));
const constituencyByGuid = new Map(
  mappingRows.map((d) => [d.ED_GUID, d["NEW CONSTITUENCY"]]),
);
const sourceById = new Map(
  sourceRows.map((row) => [normaliseEdId(row.ED_ID_STR), row]),
);

if (sourceById.size !== sourceRows.length) {
  throw new Error("The deprivation source contains duplicate ED identifiers");
}

const outputRows = geometry.features.map((feature) => {
  const properties = feature?.properties ?? {};
  const sourceId = normaliseEdId(properties.ED_ID_STR);
  const source = sourceById.get(sourceId);

  if (!source) {
    throw new Error(`No deprivation record for ${properties.ED_ENGLISH ?? properties.ED_GUID}`);
  }

  const score = Number(source.Index22_ED_std_rel_wt);
  if (!Number.isFinite(score)) {
    throw new Error(`Invalid deprivation score for ${source.ED_ENGLISH ?? source.ED_ID_STR}`);
  }

  return {
    "NEW CONSTITUENCY": constituencyByGuid.get(properties.ED_GUID),
    ED_GUID: properties.ED_GUID,
    GEOGDESC: properties.ED_NAME,
    "Source ED ID": source.ED_ID_STR,
    "Deprivation score": score,
    "Deprivation description": source.Index22_ED_rel_wt_lab,
  };
});

if (outputRows.length !== mappingRows.length) {
  throw new Error(`Expected ${mappingRows.length} mapped EDs, received ${outputRows.length}`);
}
if (outputRows.some((row) => !row["NEW CONSTITUENCY"])) {
  throw new Error("One or more deprivation records has no constituency mapping");
}

const representedSourceIds = new Set(outputRows.map((row) => normaliseEdId(row["Source ED ID"])));
const unusedSourceIds = [...sourceById.keys()].filter((id) => !representedSourceIds.has(id));
if (unusedSourceIds.length) {
  throw new Error(`${unusedSourceIds.length} deprivation source records were not matched`);
}

await fs.writeFile(outputPath, `${csvFormat(outputRows)}\n`, "utf8");
console.log(`Wrote ${outputRows.length.toLocaleString("en-IE")} electoral divisions to ${outputPath}`);
console.log("Matched every HP Deprivation Index source record to the 2022 ED geography");

function normaliseEdId(value) {
  return String(value ?? "")
    .split("/")
    .map((part) => String(Number(part)))
    .join("/");
}
