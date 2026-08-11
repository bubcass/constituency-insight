import fs from "node:fs/promises";

const DEBATES_URL =
  "https://api.oireachtas.ie/v1/debates?chamber_type=house&chamber=dail&date_start=2025-01-01&date_end=2099-01-01&limit=200";

function makeDebateUrl(record, section) {
  const recordUri = record?.debateRecord?.uri ?? "";
  const sectionId = section?.debateSection?.debateSectionId ?? "";

  if (!recordUri || !sectionId) return null;

  return (
    "https://www.oireachtas.ie/en/debates/debate" +
    recordUri.slice(46, -11) +
    sectionId.slice(7)
  );
}

export function extractDebateSections(results = []) {
  return results.flatMap((record) => {
    const date = record?.debateRecord?.date ?? null;
    const forum = record?.debateRecord?.chamber?.showAs ?? null;
    const xml = record?.debateRecord?.formats?.xml?.uri ?? null;
    const debateSections = record?.debateRecord?.debateSections ?? [];

    return debateSections.map((section) => ({
      date,
      forum,
      topic: section?.debateSection?.showAs ?? null,
      value: section?.debateSection?.counts?.speechCount ?? null,
      webpage: makeDebateUrl(record, section),
      xml,
    }));
  });
}

export function filterSportsDebates(rows = []) {
  const matcher = /\b(sports)\b|sports funding/i;

  return rows.filter((row) => matcher.test(row.topic ?? ""));
}

async function fetchDebates(url = DEBATES_URL) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Debates API request failed: ${response.status} ${response.statusText}`,
    );
  }

  const json = await response.json();
  return json?.results ?? [];
}

async function main() {
  const results = await fetchDebates();
  const rows = extractDebateSections(results);
  const sportsRows = filterSportsDebates(rows);

  await fs.mkdir("data/derived", { recursive: true });

  await fs.writeFile(
    "src/data/derived/debates-sections.json",
    JSON.stringify(rows, null, 2),
    "utf-8",
  );

  await fs.writeFile(
    "src/data/derived/debates-sections-sports.json",
    JSON.stringify(sportsRows, null, 2),
    "utf-8",
  );

  console.log(`Saved ${rows.length} debate sections`);
  console.log(`Saved ${sportsRows.length} sports-related debate sections`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
