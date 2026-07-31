import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const API_URL = "https://api.oireachtas.ie/v1/members?date_start=2024-11-15&chamber=dail&house_no=34";
const PAGE_SIZE = 1_000;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.resolve(SCRIPT_DIR, "../data/members-lookup.json");

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

async function fetchMembers() {
  const rows = [];
  let expected = null;

  for (let skip = 0; skip < 100_000; skip += PAGE_SIZE) {
    const url = new URL(API_URL);
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("skip", String(skip));

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Members API returned ${response.status} for ${url}`);

    const json = await response.json();
    const batch = Array.isArray(json?.results) ? json.results : [];
    const resultCount = Number(json?.head?.counts?.resultCount);
    if (Number.isFinite(resultCount)) expected = resultCount;
    rows.push(...batch);

    if (!batch.length || batch.length < PAGE_SIZE || (expected !== null && rows.length >= expected)) break;
  }

  if (expected !== null && rows.length < expected) {
    throw new Error(`Incomplete members response: expected ${expected}, received ${rows.length}`);
  }

  return rows;
}

function latestDailMembership(member) {
  return (member?.memberships ?? [])
    .map((item) => item?.membership)
    .filter((membership) => clean(membership?.house?.showAs) === "34th Dáil")
    .at(-1) ?? null;
}

function committeesFor(membership) {
  return (membership?.committees ?? []).map((committee) => {
    const name = committee?.committeeName?.[0]?.nameEn ?? "Unnamed Committee";
    const role = committee?.role?.title;
    return role ? `${name} (${role})` : name;
  });
}

function buildLookup(rows) {
  const lookup = {};

  for (const row of rows) {
    const member = row?.member;
    const membership = latestDailMembership(member);
    const memberCode = member?.memberCode;
    if (!memberCode || !membership) continue;

    const representation = membership?.represents?.[0]?.represent;
    const party = membership?.parties?.at(-1)?.party;

    lookup[memberCode] = {
      memberCode,
      memberName: member?.fullName ?? null,
      house: membership?.house?.showAs ?? null,
      constituency: representation?.showAs ?? null,
      constituencyCode: representation?.representCode ?? null,
      party: party?.showAs ?? null,
      partyCode: party?.partyCode ?? null,
      startDate: membership?.dateRange?.start ?? null,
      endDate: membership?.dateRange?.end ?? null,
      committees: committeesFor(membership),
      memberUrl: `https://www.oireachtas.ie/en/members/member/${memberCode}/`
    };
  }

  return lookup;
}

const rows = await fetchMembers();
const lookup = buildLookup(rows);
const members = Object.values(lookup);

if (!members.length || members.some((member) => !member.constituency || !member.startDate)) {
  throw new Error("Members lookup validation failed");
}

await fs.writeFile(OUTPUT, `${JSON.stringify(lookup, null, 2)}\n`);

const sitting = members.filter((member) => !member.endDate).length;
console.log(`Wrote ${members.length} 34th Dáil membership records (${sitting} sitting) to ${OUTPUT}`);
