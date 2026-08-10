export function filterDerelictSites(rows, {constituency} = {}) {
  const target = clean(constituency);
  if (!target) return [];
  return (Array.isArray(rows) ? rows : []).filter((row) => clean(row.constituency) === target);
}

export function buildDerelictSiteSummary(rows, constituency) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const authorityNames = Array.from(
    new Set(safeRows.map((row) => clean(row.local_authority)).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "en"));
  const eircodes = safeRows.filter((row) => clean(row.eircode)).length;
  const locationEvidence = dominantValue(safeRows, "location_category");
  const locationEvidenceLabel = formatLocationEvidence(locationEvidence.value);
  const count = safeRows.length;
  const scope = clean(constituency) || "the selected constituency";

  const headline = count === 0
    ? `No mapped derelict-site register records are available for ${scope}.`
    : count === 1
      ? `One derelict-site register record is mapped in ${scope}.`
      : `${formatInteger(count)} derelict-site register records are mapped in ${scope}.`;

  return {
    headline,
    detail: count
      ? "These are official local-authority register records with authoritative location evidence, not a survey of every derelict property."
      : "This does not mean there are no derelict sites. Records can only be assigned to a constituency when an official source provides usable location evidence.",
    metrics: count ? [
      {
        label: authorityNames.length === 1 ? "Published by" : "Publishing authorities",
        value: authorityNames.length === 1
          ? authorityNames[0]
          : authorityNames.length
            ? `${formatInteger(authorityNames.length)} local authorities`
            : "No publisher shown",
        note: authorityNames.length > 1
          ? joinList(authorityNames)
          : "Official derelict sites register",
        compactValue: true,
      },
      {
        label: "With an Eircode",
        value: count ? formatPercent(eircodes / count) : "—",
        note: count ? `${formatInteger(eircodes)} of ${formatInteger(count)} mapped records` : "No mapped records",
      },
      {
        label: "Location evidence",
        value: locationEvidenceLabel || "Not available",
        note: count && locationEvidence.count
          ? `${formatInteger(locationEvidence.count)} of ${formatInteger(count)} mapped records`
          : "No mapped records",
        compactValue: true,
      },
    ] : [],
  };
}

export function buildDerelictSiteMetrics(rows) {
  return buildDerelictSiteSummary(rows).metrics;
}

export function buildAuthoritySegments(rows, palette = []) {
  const counts = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const authority = clean(row.local_authority);
    if (authority) counts.set(authority, (counts.get(authority) ?? 0) + 1);
  }
  const ordered = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en"));
  const total = ordered.reduce((sum, [, value]) => sum + value, 0);
  let cumulative = 0;
  return {
    total,
    segments: ordered.map(([Segment, value], index) => {
      const x1 = cumulative;
      cumulative += value;
      return {Segment, value, x1, x2: cumulative, share: total ? value / total : 0, color: palette[index % palette.length]};
    }),
  };
}

export function buildDerelictSiteDownloadRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    record_id: row.record_id,
    constituency: row.constituency,
    local_authority: row.local_authority,
    register_reference: row.register_reference,
    address_or_description: row.address_or_description,
    description: row.description,
    eircode: row.eircode,
    latitude: row.latitude,
    longitude: row.longitude,
    location_source: row.location_source,
    location_precision: row.location_precision,
    source_x: row.source_x,
    source_y: row.source_y,
    source_coordinate_system: row.source_coordinate_system,
    source_geometry_type: row.source_geometry_type,
    date_entered: row.date_entered,
    valuation: row.valuation,
    source_url: row.source_url,
    source_date: row.source_date,
    retrieved_date: row.retrieved_date,
    source_format: row.source_format,
    acquisition_method: row.acquisition_method,
    extraction_quality: row.extraction_quality,
  }));
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function formatInteger(value) {
  return new Intl.NumberFormat("en-IE", {maximumFractionDigits: 0}).format(Number(value) || 0);
}

function formatPercent(value) {
  return new Intl.NumberFormat("en-IE", {style: "percent", maximumFractionDigits: 0}).format(value || 0);
}

function dominantValue(rows, field) {
  const counts = new Map();
  for (const row of rows) {
    const value = clean(row?.[field]);
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const [value = "", count = 0] = [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en"))[0] ?? [];
  return {value, count};
}

function joinList(values) {
  return new Intl.ListFormat("en-IE", {style: "long", type: "conjunction"}).format(values);
}

function formatLocationEvidence(value) {
  return {
    "Authority point": "Council-published point",
    "Polygon centroid": "Council-published area",
    "Transformed grid reference": "Council grid reference",
    "Other authority location": "Council-published location",
  }[value] ?? value;
}
