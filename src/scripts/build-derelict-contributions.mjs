import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const LOOKBACK_DAYS = 548;
const API_URL = "https://api.oireachtas.ie/v1/debates";
const MATCHER = /\b(?:derelict(?:ion)?|derelict sites?|vacant and derelict|vacant sites?|vacant propert(?:y|ies)|vacant homes?|long-term vacancy)\b/i;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.resolve(SCRIPT_DIR, "../data/derived/recent-derelict-contributions.json");

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function dateChunks(dateStart, dateEnd, daysPerChunk = 31) {
  const chunks = [];
  const finalDate = new Date(`${dateEnd}T00:00:00Z`);
  let cursor = new Date(`${dateStart}T00:00:00Z`);
  while (cursor <= finalDate) {
    const end = new Date(Math.min(addUtcDays(cursor, daysPerChunk - 1).getTime(), finalDate.getTime()));
    chunks.push([isoDate(cursor), isoDate(end)]);
    cursor = addUtcDays(end, 1);
  }
  return chunks;
}

async function fetchJson(url, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {headers: {accept: "application/json"}});
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw new Error(lastError?.message ?? "Debate request failed");
}

async function fetchDebates(dateStart, dateEnd) {
  const query = new URLSearchParams({
    chamber_type: "house",
    chamber: "dail",
    date_start: dateStart,
    date_end: dateEnd,
    limit: "100",
  });
  const data = await fetchJson(`${API_URL}?${query}`);
  return Array.isArray(data?.results) ? data.results : [];
}

function extractMatches(results) {
  const contributions = new Map();
  for (const result of results) {
    const debate = result?.debateRecord;
    const date = clean(debate?.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    for (const wrapper of debate?.debateSections ?? []) {
      const section = wrapper?.debateSection;
      const sectionId = clean(section?.debateSectionId);
      const sectionMatch = /^dbsect_(\d+)$/.exec(sectionId);
      if (!sectionMatch) continue;
      const sectionNumber = sectionMatch[1];
      const matchedSpeakers = new Map();
      for (const item of section?.text ?? []) {
        if (item?.textType !== "speech") continue;
        const speechText = clean(item?.text);
        if (!MATCHER.test(speechText)) continue;
        const speaker = item?.speaker;
        const memberCode = clean(speaker?.memberCode);
        if (!memberCode) continue;
        const row = matchedSpeakers.get(memberCode) ?? {
          memberCode,
          memberName: clean(speaker?.showAs),
          memberUri: clean(speaker?.uri),
          roles: [],
          speechCount: 0,
        };
        row.speechCount += 1;
        const role = clean(speaker?.role);
        if (role) row.roles.push(role);
        matchedSpeakers.set(memberCode, row);
      }
      for (const speaker of matchedSpeakers.values()) {
        const key = `${date}|${sectionId}|${speaker.memberCode}`;
        contributions.set(key, {
          date,
          chamber: "dail",
          sectionId,
          sectionNumber,
          topic: clean(section?.showAs) || "Dáil debate",
          parentTopic: clean(section?.parentDebateSection?.showAs),
          memberCode: speaker.memberCode,
          memberName: speaker.memberName,
          memberUri: speaker.memberUri,
          roles: [...new Set(speaker.roles)],
          speechCount: speaker.speechCount,
          url: `https://www.oireachtas.ie/en/debates/debate/dail/${date}/${sectionNumber}/member-speech/${speaker.memberCode}/`,
        });
      }
    }
  }
  return [...contributions.values()].sort((a, b) => b.date.localeCompare(a.date) || Number(b.sectionNumber) - Number(a.sectionNumber));
}

async function main() {
  const dateEnd = isoDate(new Date());
  const dateStart = isoDate(addUtcDays(new Date(`${dateEnd}T00:00:00Z`), 1 - LOOKBACK_DAYS));
  const results = (await Promise.all(dateChunks(dateStart, dateEnd).map(([start, end]) => fetchDebates(start, end)))).flat();
  const contributions = extractMatches(results);
  await fs.mkdir(path.dirname(OUTPUT), {recursive: true});
  await fs.writeFile(OUTPUT, `${JSON.stringify(contributions, null, 2)}\n`, "utf8");
  console.log(`Wrote ${contributions.length} derelict-site contributions from ${dateStart} to ${dateEnd}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
