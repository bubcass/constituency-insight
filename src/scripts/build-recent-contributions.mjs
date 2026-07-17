import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const DEFAULT_LOOKBACK_DAYS = 548;
const DEFAULT_PER_MEMBER_LIMIT = 12;
const DEFAULT_TOPIC_PER_MEMBER_LIMIT = 60;
const API_URL = "https://api.oireachtas.ie/v1/debates";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT = path.resolve(
  SCRIPT_DIR,
  "../data/derived/recent-member-contributions.json",
);
const DEFAULT_SPORTS_OUTPUT = path.resolve(
  SCRIPT_DIR,
  "../data/derived/recent-sports-contributions.json",
);
const DEFAULT_WORK_OUTPUT = path.resolve(
  SCRIPT_DIR,
  "../data/derived/recent-work-contributions.json",
);
const DEFAULT_HOUSING_OUTPUT = path.resolve(
  SCRIPT_DIR,
  "../data/derived/recent-housing-contributions.json",
);
const DEFAULT_TRANSPORT_OUTPUT = path.resolve(
  SCRIPT_DIR,
  "../data/derived/recent-transport-contributions.json",
);
const DEFAULT_EDUCATION_OUTPUT = path.resolve(
  SCRIPT_DIR,
  "../data/derived/recent-education-contributions.json",
);
const WORK_MATCHER = /\b(?:work(?:er|ers|ing|place|places)?|employment|jobs?)\b/i;
const HOUSING_MATCHER = /\b(?:housing|homeless(?:ness)?|rent(?:al|s|ed|ing)?|tenant(?:s|cy|cies)?|mortgages?|house[- ]?building|house prices?|home ownership|homeownership|first[- ]time buyers?|(?:first|new|affordable|social|vacant) homes?|residential propert(?:y|ies)|dwellings?)\b/i;
const TRANSPORT_MATCHER = /\b(?:transport|buses?|bus services?|rail(?:way)?|trains?|roads?|motorways?|traffic|road safety|cycling|cyclists?|active travel|aviation|airports?|ports?|ferr(?:y|ies)|vehicles?|commut(?:e|er|ers|ing))\b/i;
const EDUCATION_MATCHER = /\b(?:education|schools?|teachers?|pupils?|students?|classrooms?|special education|universit(?:y|ies)|colleges?|third[- ]level|further education|higher education|apprenticeships?|early learning|childcare)\b/i;

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

function parseArgs(argv) {
  const options = {
    output: DEFAULT_OUTPUT,
    sportsOutput: DEFAULT_SPORTS_OUTPUT,
    workOutput: DEFAULT_WORK_OUTPUT,
    housingOutput: DEFAULT_HOUSING_OUTPUT,
    transportOutput: DEFAULT_TRANSPORT_OUTPUT,
    educationOutput: DEFAULT_EDUCATION_OUTPUT,
    lookbackDays: DEFAULT_LOOKBACK_DAYS,
    perMemberLimit: DEFAULT_PER_MEMBER_LIMIT,
    topicPerMemberLimit: DEFAULT_TOPIC_PER_MEMBER_LIMIT,
    dateStart: null,
    dateEnd: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];

    if (argument === "--output" && value) {
      options.output = path.resolve(value);
      index += 1;
    } else if (argument === "--sports-output" && value) {
      options.sportsOutput = path.resolve(value);
      index += 1;
    } else if (argument === "--work-output" && value) {
      options.workOutput = path.resolve(value);
      index += 1;
    } else if (argument === "--housing-output" && value) {
      options.housingOutput = path.resolve(value);
      index += 1;
    } else if (argument === "--transport-output" && value) {
      options.transportOutput = path.resolve(value);
      index += 1;
    } else if (argument === "--education-output" && value) {
      options.educationOutput = path.resolve(value);
      index += 1;
    } else if (argument === "--lookback-days" && value) {
      options.lookbackDays = Number(value);
      index += 1;
    } else if (argument === "--date-start" && value) {
      options.dateStart = value;
      index += 1;
    } else if (argument === "--date-end" && value) {
      options.dateEnd = value;
      index += 1;
    } else if (argument === "--per-member-limit" && value) {
      options.perMemberLimit = Number(value);
      index += 1;
    } else if (argument === "--topic-per-member-limit" && value) {
      options.topicPerMemberLimit = Number(value);
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }

  if (!Number.isInteger(options.lookbackDays) || options.lookbackDays < 1) {
    throw new Error("--lookback-days must be a positive integer");
  }
  if (!Number.isInteger(options.perMemberLimit) || options.perMemberLimit < 1) {
    throw new Error("--per-member-limit must be a positive integer");
  }
  if (!Number.isInteger(options.topicPerMemberLimit) || options.topicPerMemberLimit < 1) {
    throw new Error("--topic-per-member-limit must be a positive integer");
  }

  return options;
}

function dateChunks(dateStart, dateEnd, daysPerChunk = 31) {
  const chunks = [];
  const finalDate = new Date(`${dateEnd}T00:00:00Z`);
  let cursor = new Date(`${dateStart}T00:00:00Z`);

  while (cursor <= finalDate) {
    const chunkEnd = new Date(
      Math.min(addUtcDays(cursor, daysPerChunk - 1).getTime(), finalDate.getTime()),
    );
    chunks.push([isoDate(cursor), isoDate(chunkEnd)]);
    cursor = addUtcDays(chunkEnd, 1);
  }

  return chunks;
}

async function fetchJson(url, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {headers: {accept: "application/json"}});
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
      }
    }
  }

  throw new Error(`Failed to fetch ${url}: ${lastError?.message ?? lastError}`);
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

function extractContributions(results) {
  const contributions = new Map();

  for (const result of results) {
    const debate = result?.debateRecord;
    const date = debate?.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) continue;

    for (const wrapper of debate?.debateSections ?? []) {
      const section = wrapper?.debateSection;
      const sectionId = section?.debateSectionId ?? "";
      const sectionMatch = /^dbsect_(\d+)$/.exec(sectionId);
      if (!sectionMatch) continue;

      const sectionNumber = sectionMatch[1];
      const sectionSpeakers = new Map();

      for (const item of section?.text ?? []) {
        if (item?.textType !== "speech") continue;
        const speaker = item?.speaker;
        const memberCode = clean(speaker?.memberCode);
        if (!memberCode) continue;

        const row = sectionSpeakers.get(memberCode) ?? {
          memberCode,
          memberName: clean(speaker?.showAs),
          memberUri: clean(speaker?.uri),
          roles: [],
          speechCount: 0,
        };

        row.speechCount += 1;
        const role = clean(speaker?.role);
        if (role) row.roles.push(role);
        sectionSpeakers.set(memberCode, row);
      }

      for (const speaker of sectionSpeakers.values()) {
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

  return [...contributions.values()].sort((a, b) => {
    const dateComparison = b.date.localeCompare(a.date);
    if (dateComparison !== 0) return dateComparison;
    const sectionComparison = Number(b.sectionNumber) - Number(a.sectionNumber);
    if (sectionComparison !== 0) return sectionComparison;
    return a.memberName.localeCompare(b.memberName, "en");
  });
}

function limitPerMember(contributions, limit) {
  const counts = new Map();
  return contributions.filter((row) => {
    const count = counts.get(row.memberCode) ?? 0;
    if (count >= limit) return false;
    counts.set(row.memberCode, count + 1);
    return true;
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const dateEnd = options.dateEnd ?? isoDate(new Date());
  const dateStart =
    options.dateStart ?? isoDate(addUtcDays(new Date(`${dateEnd}T00:00:00Z`), 1 - options.lookbackDays));

  const chunks = dateChunks(dateStart, dateEnd);
  const resultGroups = await Promise.all(
    chunks.map(([start, end]) => fetchDebates(start, end)),
  );
  const allContributions = extractContributions(resultGroups.flat());
  const contributions = limitPerMember(
    allContributions,
    options.perMemberLimit,
  );
  const sportsContributions = limitPerMember(
    allContributions.filter((row) => /\bsports?\b/i.test(row.topic)),
    options.topicPerMemberLimit,
  );
  const workContributions = limitPerMember(
    allContributions.filter((row) => WORK_MATCHER.test(`${row.topic} ${row.parentTopic}`)),
    options.topicPerMemberLimit,
  );
  const housingContributions = limitPerMember(
    allContributions.filter((row) => HOUSING_MATCHER.test(`${row.topic} ${row.parentTopic}`)),
    options.topicPerMemberLimit,
  );
  const transportContributions = limitPerMember(
    allContributions.filter((row) => TRANSPORT_MATCHER.test(`${row.topic} ${row.parentTopic}`)),
    options.topicPerMemberLimit,
  );
  const educationContributions = limitPerMember(
    allContributions.filter((row) => EDUCATION_MATCHER.test(`${row.topic} ${row.parentTopic}`)),
    options.topicPerMemberLimit,
  );

  await fs.mkdir(path.dirname(options.output), {recursive: true});
  await fs.writeFile(options.output, `${JSON.stringify(contributions, null, 2)}\n`, "utf8");
  await fs.mkdir(path.dirname(options.sportsOutput), {recursive: true});
  await fs.writeFile(
    options.sportsOutput,
    `${JSON.stringify(sportsContributions, null, 2)}\n`,
    "utf8",
  );
  await fs.mkdir(path.dirname(options.workOutput), {recursive: true});
  await fs.writeFile(
    options.workOutput,
    `${JSON.stringify(workContributions, null, 2)}\n`,
    "utf8",
  );
  await fs.mkdir(path.dirname(options.housingOutput), {recursive: true});
  await fs.writeFile(
    options.housingOutput,
    `${JSON.stringify(housingContributions, null, 2)}\n`,
    "utf8",
  );
  await fs.mkdir(path.dirname(options.transportOutput), {recursive: true});
  await fs.writeFile(
    options.transportOutput,
    `${JSON.stringify(transportContributions, null, 2)}\n`,
    "utf8",
  );
  await fs.mkdir(path.dirname(options.educationOutput), {recursive: true});
  await fs.writeFile(
    options.educationOutput,
    `${JSON.stringify(educationContributions, null, 2)}\n`,
    "utf8",
  );

  const memberCount = new Set(contributions.map((row) => row.memberCode)).size;
  console.log(
    `Wrote ${contributions.length} contributions for ${memberCount} members ` +
      `from ${dateStart} to ${dateEnd} to ${options.output}`,
  );
  console.log(`Wrote ${sportsContributions.length} sports contributions to ${options.sportsOutput}`);
  console.log(`Wrote ${workContributions.length} work-related contributions to ${options.workOutput}`);
  console.log(`Wrote ${housingContributions.length} housing-related contributions to ${options.housingOutput}`);
  console.log(`Wrote ${transportContributions.length} transport-related contributions to ${options.transportOutput}`);
  console.log(`Wrote ${educationContributions.length} education-related contributions to ${options.educationOutput}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
