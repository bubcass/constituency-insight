import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const DEFAULT_LOOKBACK_DAYS = 548;
const PER_CONSTITUENCY_LIMIT = 60;
const PQ_EXPLORER_RAW_BASE =
  "https://raw.githubusercontent.com/bubcass/pq-explorer/main/src/data/pq";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(SCRIPT_DIR, "../data");
const DERIVED_DIR = path.join(DATA_DIR, "derived");

const TOPICS = [
  {
    name: "sports",
    output: path.join(DERIVED_DIR, "recent-sports-questions.json"),
    matcher: /\bsports?\b|sports capital|sports funding|sports facilities/i,
  },
  {
    name: "work",
    output: path.join(DERIVED_DIR, "recent-work-questions.json"),
    matcher: /\b(?:work(?:er|ers|ing|place|places)?|employment|jobs?)\b/i,
  },
  {
    name: "housing",
    output: path.join(DERIVED_DIR, "recent-housing-questions.json"),
    matcher: /\b(?:housing|homeless(?:ness)?|rent(?:al|s|ed|ing)?|tenant(?:s|cy|cies)?|mortgages?|house[- ]?building|house prices?|home ownership|homeownership|first[- ]time buyers?|(?:first|new|affordable|social|vacant) homes?|residential propert(?:y|ies)|dwellings?)\b/i,
  },
  {
    name: "transport",
    output: path.join(DERIVED_DIR, "recent-transport-questions.json"),
    matcher: /\b(?:transport|buses?|bus services?|rail(?:way)?|trains?|roads?|motorways?|traffic|road safety|cycling|cyclists?|active travel|aviation|airports?|ports?|ferr(?:y|ies)|vehicles?|commut(?:e|er|ers|ing))\b/i,
  },
  {
    name: "education",
    output: path.join(DERIVED_DIR, "recent-education-questions.json"),
    matcher: /\b(?:education|schools?|teachers?|pupils?|students?|classrooms?|special education|universit(?:y|ies)|colleges?|third[- ]level|further education|higher education|apprenticeships?|early learning|childcare)\b/i,
  },
];

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

function normaliseName(value) {
  return clean(value).replace(/^Deputy\s+/i, "").toLocaleLowerCase("en-IE");
}

function parseArgs(argv) {
  const options = {
    sourceBase: PQ_EXPLORER_RAW_BASE,
    sourceDir: null,
    members: path.join(DATA_DIR, "members-lookup.json"),
    generalOutput: path.join(DERIVED_DIR, "recent-questions.json"),
    lookbackDays: DEFAULT_LOOKBACK_DAYS,
    dateStart: null,
    dateEnd: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];

    if (argument === "--source-base" && value) {
      options.sourceBase = value.replace(/\/$/, "");
    } else if (argument === "--source-dir" && value) {
      options.sourceDir = path.resolve(value);
    } else if (argument === "--members" && value) {
      options.members = path.resolve(value);
    } else if (argument === "--general-output" && value) {
      options.generalOutput = path.resolve(value);
    } else if (argument === "--lookback-days" && value) {
      options.lookbackDays = Number(value);
    } else if (argument === "--date-start" && value) {
      options.dateStart = value;
    } else if (argument === "--date-end" && value) {
      options.dateEnd = value;
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
    index += 1;
  }

  if (!Number.isInteger(options.lookbackDays) || options.lookbackDays < 1) {
    throw new Error("--lookback-days must be a positive integer");
  }

  return options;
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
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
      }
    }
  }

  throw new Error(`Failed to fetch ${url}: ${lastError?.message ?? lastError}`);
}

async function readPqExplorerYear(year, options) {
  if (options.sourceDir) {
    const file = path.join(
      options.sourceDir,
      String(year),
      "constituency-download-all.json",
    );
    return JSON.parse(await fs.readFile(file, "utf8"));
  }

  const url = `${options.sourceBase}/${year}/constituency-download-all.json`;
  console.log(`Fetching PQ Explorer questions for ${year}...`);
  return fetchJson(url);
}

function yearsBetween(dateStart, dateEnd) {
  const first = Number(dateStart.slice(0, 4));
  const last = Number(dateEnd.slice(0, 4));
  return Array.from({length: last - first + 1}, (_, index) => first + index);
}

function activeMembersByConstituency(lookup, asOf) {
  const grouped = new Map();

  for (const member of Object.values(lookup ?? {})) {
    const constituency = clean(member?.constituency);
    const name = normaliseName(member?.memberName);
    const start = clean(member?.startDate);
    const end = clean(member?.endDate);
    if (!constituency || !name) continue;
    if (start && start > asOf) continue;
    if (end && end < asOf) continue;
    if (!grouped.has(constituency)) grouped.set(constituency, new Set());
    grouped.get(constituency).add(name);
  }

  return grouped;
}

function flattenSource(groups, activeMembers, dateStart, dateEnd) {
  const rows = new Map();

  for (const group of groups.flat()) {
    const constituency = clean(group?.constituency).replace(/\s*\(\d+\)\s*$/, "");
    const activeNames = activeMembers.get(constituency);
    if (!constituency || !activeNames) continue;

    for (const question of group?.questions ?? []) {
      const date = clean(question?.date).slice(0, 10);
      const deputy = clean(question?.deputy).replace(/^Deputy\s+/i, "");
      if (date < dateStart || date > dateEnd) continue;
      if (!activeNames.has(normaliseName(deputy))) continue;

      const row = {
        date,
        deputy,
        department: clean(question?.department),
        heading: clean(question?.heading) || "Parliamentary question",
        question: clean(question?.question),
        url: clean(question?.url),
      };
      const key = `${constituency}|${row.date}|${row.deputy}|${row.url}|${row.heading}`;
      rows.set(key, {constituency, ...row});
    }
  }

  return [...rows.values()].sort(
    (a, b) =>
      a.constituency.localeCompare(b.constituency, "en") ||
      b.date.localeCompare(a.date) ||
      a.deputy.localeCompare(b.deputy, "en") ||
      a.heading.localeCompare(b.heading, "en"),
  );
}

function searchableText(row) {
  const question = clean(row.question).replace(
    /^\d+\.\s+Deputy\s+.+?\s+asked\s+.+?\s+(?:if|whether)\s+/i,
    "",
  );
  return `${row.heading} ${question}`;
}

function groupByConstituency(rows, matcher = null) {
  const grouped = new Map();

  for (const {constituency, ...question} of rows) {
    if (matcher && !matcher.test(searchableText(question))) continue;
    const questions = grouped.get(constituency) ?? [];
    if (questions.length < PER_CONSTITUENCY_LIMIT) questions.push(question);
    grouped.set(constituency, questions);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([constituency, questions]) => ({constituency, questions}));
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), {recursive: true});
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const dateEnd = options.dateEnd ?? isoDate(new Date());
  const dateStart = options.dateStart ??
    isoDate(addUtcDays(new Date(`${dateEnd}T00:00:00Z`), 1 - options.lookbackDays));
  const years = yearsBetween(dateStart, dateEnd);
  const [membersLookup, ...sourceGroups] = await Promise.all([
    fs.readFile(options.members, "utf8").then(JSON.parse),
    ...years.map((year) => readPqExplorerYear(year, options)),
  ]);
  const activeMembers = activeMembersByConstituency(membersLookup, dateEnd);
  const rows = flattenSource(sourceGroups, activeMembers, dateStart, dateEnd);
  const general = groupByConstituency(rows);
  const generalCount = general.reduce((sum, group) => sum + group.questions.length, 0);

  await writeJson(options.generalOutput, general);
  console.log(
    `Wrote ${generalCount} recent questions for ${general.length} constituencies ` +
      `from PQ Explorer (${dateStart} to ${dateEnd})`,
  );

  for (const topic of TOPICS) {
    const grouped = groupByConstituency(rows, topic.matcher);
    const count = grouped.reduce((sum, group) => sum + group.questions.length, 0);
    await writeJson(topic.output, grouped);
    console.log(`Wrote ${count} ${topic.name} questions to ${topic.output}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
