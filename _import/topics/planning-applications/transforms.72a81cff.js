export function filterPlanningApplications(
  rows,
  {constituency, electoralDistrictGuid, startYear, endYear} = {}
) {
  const target = cleanText(constituency);
  const districtTarget = cleanText(electoralDistrictGuid);
  const lowerYear = Number(startYear);
  const upperYear = Number(endYear);
  if (!target) return [];

  return (Array.isArray(rows) ? rows : []).filter(
    (row) =>
      cleanText(row.constituency) === target &&
      (!districtTarget ||
        districtTarget === "all" ||
        cleanText(row.electoral_district_guid) === districtTarget) &&
      (!Number.isFinite(lowerYear) || Number(row.year) >= lowerYear) &&
      (!Number.isFinite(upperYear) || Number(row.year) <= upperYear)
  );
}

export function buildPlanningApplicationMetrics(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const topType = topCount(safeRows, (row) => row.development_type);

  return [
    {
      label: "Housing applications",
      value: formatInteger(safeRows.length),
      note: "Received in the selected period"
    },
    {
      label: "Most common development type",
      value: topType?.key ?? "—",
      note: topType
        ? `${formatInteger(topType.count)} applications`
        : "No applications"
    }
  ];
}

export function buildPlanningApplicationDownloadRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    source_record_id: row.source_record_id,
    planning_authority: row.planning_authority,
    application_number: row.application_number,
    received_date: row.received_date,
    year: row.year,
    development_type: row.development_type,
    development_address: row.development_address,
    longitude: row.longitude,
    latitude: row.latitude,
    constituency: row.constituency,
    electoral_district: row.electoral_district,
    electoral_district_guid: row.electoral_district_guid,
    application_status: row.application_status,
    application_type: row.application_type,
    decision: row.decision,
    decision_date: row.decision_date,
    residential_units_reported: row.residential_units_reported,
    one_off_house: row.one_off_house,
    application_details_url: row.application_details_url,
    application_link_type: row.application_link_type
  }));
}

function topCount(rows, accessor) {
  const counts = new Map();
  for (const row of rows) {
    const key = cleanText(accessor(row));
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts, ([key, count]) => ({key, count})).sort(
    (a, b) => b.count - a.count || a.key.localeCompare(b.key, "en")
  )[0];
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function formatInteger(value) {
  return new Intl.NumberFormat("en-IE", {maximumFractionDigits: 0}).format(
    Number(value) || 0
  );
}
