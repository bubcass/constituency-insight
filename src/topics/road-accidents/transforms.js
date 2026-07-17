export function filterRoadAccidents(
  rows,
  { constituency, year, startYear, endYear } = {},
) {
  const target = cleanText(constituency);
  if (!target) return [];

  const fallbackYear = Number(year);
  const lowerYear = Number.isFinite(Number(startYear))
    ? Number(startYear)
    : fallbackYear;
  const upperYear = Number.isFinite(Number(endYear))
    ? Number(endYear)
    : fallbackYear;

  return (Array.isArray(rows) ? rows : []).filter(
    (row) =>
      cleanText(row.constituency) === target &&
      (!Number.isFinite(lowerYear) || Number(row.year) >= lowerYear) &&
      (!Number.isFinite(upperYear) || Number(row.year) <= upperYear),
  );
}

export function buildRoadAccidentMetrics(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const fatalityCount = safeRows.reduce(
    (sum, row) => sum + (Number(row.fatality_count) || 0),
    0,
  );
  const topDistrict = topCount(safeRows, (row) => row.electoral_district);
  const topYear = topCount(safeRows, (row) => row.year, { numeric: true });

  return [
    {
      label: "Incidents",
      value: formatInteger(safeRows.length),
      note: "In this period",
    },
    {
      label: "Fatalities",
      value: formatInteger(fatalityCount),
      note: "People recorded as deceased",
    },
    {
      label: "Most incidents by electoral district",
      value: topDistrict?.key ?? "—",
      note: topDistrict
        ? `${formatInteger(topDistrict.count)} incidents · 2022 electoral district`
        : "No matched electoral district",
    },
    {
      label: "Peak year",
      value: topYear?.key ?? "—",
      note: topYear ? `${formatInteger(topYear.count)} incidents` : "No incidents",
    },
  ];
}

export function buildRoadUserSegments(rows, palette = {}) {
  const definitions = [
    ["Drivers", "driver_count"],
    ["Passengers", "passenger_count"],
    ["Pedestrians", "pedestrian_count"],
    ["Cyclists", "cyclist_count"],
    ["Motorcyclists", "motorcyclist_count"],
    ["E-scooter/other", "e_scooter_other_count"],
  ];
  const totals = definitions
    .map(([Segment, field]) => ({
      Segment,
      value: (Array.isArray(rows) ? rows : []).reduce(
        (sum, row) => sum + (Number(row[field]) || 0),
        0,
      ),
      color: palette[Segment],
    }))
    .filter((segment) => segment.value > 0)
    .sort(
      (a, b) =>
        b.value - a.value || a.Segment.localeCompare(b.Segment, "en"),
    );
  const total = totals.reduce((sum, segment) => sum + segment.value, 0);
  let cumulative = 0;

  return {
    total,
    segments: totals.map((segment) => {
      const x1 = cumulative;
      cumulative += segment.value;
      return {
        ...segment,
        x1,
        x2: cumulative,
        share: total > 0 ? segment.value / total : 0,
      };
    }),
  };
}

export function buildRoadAccidentDownloadRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    incident_id: row.incident_id,
    date: row.date,
    year: row.year,
    time_band: row.time_band,
    constituency: row.constituency,
    electoral_district: row.electoral_district,
    electoral_district_guid: row.electoral_district_guid,
    longitude: row.longitude,
    latitude: row.latitude,
    incident_type: row.incident_type,
    fatality_count: row.fatality_count,
    serious_injury_count: row.serious_injury_count,
    non_serious_injury_count: row.non_serious_injury_count,
    casualty_count: row.casualty_count,
    cyclist_count: row.cyclist_count,
    driver_count: row.driver_count,
    e_scooter_other_count: row.e_scooter_other_count,
    motorcyclist_count: row.motorcyclist_count,
    passenger_count: row.passenger_count,
    pedestrian_count: row.pedestrian_count,
  }));
}

function topCount(rows, accessor, { numeric = false } = {}) {
  const counts = new Map();
  for (const row of rows) {
    const key = cleanText(accessor(row));
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts, ([key, count]) => ({ key, count })).sort(
    (a, b) =>
      b.count - a.count ||
      (numeric
        ? Number(b.key) - Number(a.key)
        : a.key.localeCompare(b.key, "en")),
  )[0];
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatInteger(value) {
  return new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 }).format(
    Number(value) || 0,
  );
}
