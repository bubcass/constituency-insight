import fs from "node:fs/promises";
import path from "node:path";

const INPUT_FILES = [
  "/Users/david/Developer/Open_Data_Insights/2026-03-25_pq-explorer-framework/src/data/pq/2025/flat-enriched.json",
  "/Users/david/Developer/Open_Data_Insights/2026-03-25_pq-explorer-framework/src/data/pq/2026/flat-enriched.json",
];

const OUTPUT_FILE = path.resolve(
  "src/data/derived/pq-sports-related-by-constituency.json",
);

const SPORTS_MATCHER =
  /\b(sports capital|sports funding|sport|sports facilities)\b/i;

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normaliseConstituency(value) {
  return clean(value).replace(/\s*\(\d+\)\s*$/, "");
}

function matchesSportsHeading(row) {
  return SPORTS_MATCHER.test(clean(row.heading));
}

function mapRow(row, yearHint = null) {
  return {
    year: row.year ?? yearHint,
    date: row.date_iso ?? row.date ?? null,
    constituency: normaliseConstituency(row.constituency),
    deputy: clean(row.deputy),
    department: clean(row.department),
    heading: clean(row.heading),
    question: clean(row.question),
    url: clean(row.url),
  };
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

function groupByConstituency(rows) {
  const grouped = new Map();

  for (const row of rows) {
    const constituency = row.constituency;
    if (!constituency) continue;

    if (!grouped.has(constituency)) {
      grouped.set(constituency, []);
    }

    grouped.get(constituency).push(row);
  }

  const sortedEntries = Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([constituency, items]) => [
      constituency,
      items.sort((a, b) => {
        const dateCmp = String(b.date ?? "").localeCompare(
          String(a.date ?? ""),
        );
        if (dateCmp !== 0) return dateCmp;
        return a.deputy.localeCompare(b.deputy, "en");
      }),
    ]);

  return Object.fromEntries(sortedEntries);
}

async function main() {
  const allRows = [];

  for (const filePath of INPUT_FILES) {
    const yearMatch = filePath.match(/\/pq\/(\d{4})\//);
    const yearHint = yearMatch ? Number(yearMatch[1]) : null;

    const rows = await readJson(filePath);

    if (!Array.isArray(rows)) {
      throw new Error(`Expected an array in ${filePath}`);
    }

    allRows.push(...rows.map((row) => mapRow(row, yearHint)));
  }

  const filtered = allRows
    .filter((row) => row.constituency && row.deputy && row.heading)
    .filter(matchesSportsHeading)
    .filter((row) => row.url);

  const grouped = groupByConstituency(filtered);

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(grouped, null, 2), "utf-8");

  const constituencyCount = Object.keys(grouped).length;
  const rowCount = filtered.length;

  console.log(
    `Wrote ${rowCount} sports-related PQ rows across ${constituencyCount} constituencies to ${OUTPUT_FILE}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
