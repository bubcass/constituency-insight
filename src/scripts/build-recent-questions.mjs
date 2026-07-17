import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const DEFAULT_LOOKBACK_DAYS = 548;
const API_URL = "https://api.oireachtas.ie/v1/questions";
const API_PAGE_SIZE = 1_000;
const FETCH_CONCURRENCY = 3;
const PER_CONSTITUENCY_LIMIT = 60;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MEMBERS = path.resolve(SCRIPT_DIR, "../data/members-lookup.json");
const DEFAULT_OUTPUT = path.resolve(
  SCRIPT_DIR,
  "../data/derived/recent-work-questions.json",
);
const DEFAULT_HOUSING_OUTPUT = path.resolve(
  SCRIPT_DIR,
  "../data/derived/recent-housing-questions.json",
);
const DEFAULT_TRANSPORT_OUTPUT = path.resolve(
  SCRIPT_DIR,
  "../data/derived/recent-transport-questions.json",
);
const DEFAULT_EDUCATION_OUTPUT = path.resolve(
  SCRIPT_DIR,
  "../data/derived/recent-education-questions.json",
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
    housingOutput: DEFAULT_HOUSING_OUTPUT,
    transportOutput: DEFAULT_TRANSPORT_OUTPUT,
    educationOutput: DEFAULT_EDUCATION_OUTPUT,
    members: DEFAULT_MEMBERS,
    lookbackDays: DEFAULT_LOOKBACK_DAYS,
    dateStart: null,
    dateEnd: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];

    if (argument === "--output" && value) {
      options.output = path.resolve(value);
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
    } else if (argument === "--members" && value) {
      options.members = path.resolve(value);
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
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }

  if (!Number.isInteger(options.lookbackDays) || options.lookbackDays < 1) {
    throw new Error("--lookback-days must be a positive integer");
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

async function fetchQuestionChunk(dateStart, dateEnd) {
  const questions = [];

  for (let skip = 0; ; skip += API_PAGE_SIZE) {
    const query = new URLSearchParams({
      date_start: dateStart,
      date_end: dateEnd,
      skip: String(skip),
      limit: String(API_PAGE_SIZE),
      show_answers: "false",
    });
    const data = await fetchJson(`${API_URL}?${query}`);
    const results = Array.isArray(data?.results) ? data.results : [];
    questions.push(...results);

    if (results.length < API_PAGE_SIZE) break;
  }

  return questions;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({length: Math.min(concurrency, items.length)}, () => worker()),
  );
  return results;
}

function extractTopicQuestions(results, membersLookup, matcher) {
  const questions = new Map();

  for (const result of results) {
    const question = result?.question;
    const date = clean(question?.date);
    const memberCode = clean(question?.by?.memberCode);
    const member = membersLookup[memberCode];
    if (!member || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const heading = clean(question?.debateSection?.showAs) || "Parliamentary question";
    const questionText = clean(question?.showAs);
    const recipient = clean(question?.to?.showAs);
    const searchableQuestion = recipient
      ? questionText.replaceAll(recipient, "")
      : questionText;
    if (!matcher.test(`${heading} ${searchableQuestion}`)) continue;

    const questionNumber = Number(question?.questionNumber);
    if (!Number.isFinite(questionNumber)) continue;

    const key = `${date}|${questionNumber}|${memberCode}`;
    questions.set(key, {
      constituency: clean(member.constituency),
      date,
      deputy: clean(question?.by?.showAs) || clean(member.memberName),
      memberCode,
      heading,
      question: questionText,
      url: `https://www.oireachtas.ie/en/debates/question/${date}/${questionNumber}/`,
    });
  }

  return [...questions.values()].sort((a, b) => {
    const constituencyComparison = a.constituency.localeCompare(b.constituency, "en");
    if (constituencyComparison !== 0) return constituencyComparison;
    const dateComparison = b.date.localeCompare(a.date);
    if (dateComparison !== 0) return dateComparison;
    return a.heading.localeCompare(b.heading, "en");
  });
}

function groupByConstituency(questions) {
  const grouped = new Map();

  for (const {constituency, ...question} of questions) {
    if (!constituency) continue;
    const rows = grouped.get(constituency) ?? [];
    rows.push(question);
    grouped.set(constituency, rows);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([constituency, rows]) => ({
      constituency,
      questions: rows.slice(0, PER_CONSTITUENCY_LIMIT),
    }));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const dateEnd = options.dateEnd ?? isoDate(new Date());
  const dateStart =
    options.dateStart ??
    isoDate(addUtcDays(new Date(`${dateEnd}T00:00:00Z`), 1 - options.lookbackDays));
  const membersLookup = JSON.parse(await fs.readFile(options.members, "utf8"));
  const chunks = dateChunks(dateStart, dateEnd);
  const resultGroups = await mapWithConcurrency(
    chunks,
    FETCH_CONCURRENCY,
    ([start, end]) => fetchQuestionChunk(start, end),
  );
  const results = resultGroups.flat();
  const workQuestions = extractTopicQuestions(results, membersLookup, WORK_MATCHER);
  const housingQuestions = extractTopicQuestions(results, membersLookup, HOUSING_MATCHER);
  const transportQuestions = extractTopicQuestions(results, membersLookup, TRANSPORT_MATCHER);
  const educationQuestions = extractTopicQuestions(results, membersLookup, EDUCATION_MATCHER);
  const groupedWorkQuestions = groupByConstituency(workQuestions);
  const groupedHousingQuestions = groupByConstituency(housingQuestions);
  const groupedTransportQuestions = groupByConstituency(transportQuestions);
  const groupedEducationQuestions = groupByConstituency(educationQuestions);

  await fs.mkdir(path.dirname(options.output), {recursive: true});
  await fs.writeFile(
    options.output,
    `${JSON.stringify(groupedWorkQuestions, null, 2)}\n`,
    "utf8",
  );
  await fs.mkdir(path.dirname(options.housingOutput), {recursive: true});
  await fs.writeFile(
    options.housingOutput,
    `${JSON.stringify(groupedHousingQuestions, null, 2)}\n`,
    "utf8",
  );
  await fs.mkdir(path.dirname(options.transportOutput), {recursive: true});
  await fs.writeFile(
    options.transportOutput,
    `${JSON.stringify(groupedTransportQuestions, null, 2)}\n`,
    "utf8",
  );
  await fs.mkdir(path.dirname(options.educationOutput), {recursive: true});
  await fs.writeFile(
    options.educationOutput,
    `${JSON.stringify(groupedEducationQuestions, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `Wrote ${workQuestions.length} work-related questions for ${groupedWorkQuestions.length} ` +
      `constituencies from ${dateStart} to ${dateEnd} to ${options.output}`,
  );
  console.log(
    `Wrote ${housingQuestions.length} housing-related questions for ` +
      `${groupedHousingQuestions.length} constituencies to ${options.housingOutput}`,
  );
  console.log(
    `Wrote ${transportQuestions.length} transport-related questions for ` +
      `${groupedTransportQuestions.length} constituencies to ${options.transportOutput}`,
  );
  console.log(
    `Wrote ${educationQuestions.length} education-related questions for ` +
      `${groupedEducationQuestions.length} constituencies to ${options.educationOutput}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
