import { sportsFundingTopic } from "./config.js";

export function filterRowsByConstituency(rows, constituency) {
  const target = cleanText(constituency);
  if (!target) return [];

  return (Array.isArray(rows) ? rows : []).filter(
    (d) => cleanText(d.__constituency) === target,
  );
}

export function filterRowsByConstituencySlug(rows, constituencySlug) {
  const target = cleanText(constituencySlug);
  if (!target) return [];

  return (Array.isArray(rows) ? rows : []).filter(
    (d) => cleanText(d.__constituencySlug) === target,
  );
}

export function deriveSportsFundingMetrics(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];

  return {
    totalAllocated: safeSum(safeRows, (d) => d.__amount),
    projectCount: countNonEmpty(safeRows, (d) => d.__title),
    organisationCount: distinctCount(safeRows, (d) => d.__entity),
    sportTypeCount: distinctCount(safeRows, (d) => d.__category),
    latestYear: maxNumericOrText(safeRows.map((d) => d.__year)),
  };
}

export function buildMetricCardData(rows, topic = sportsFundingTopic) {
  const metrics = deriveSportsFundingMetrics(rows);
  const metricLabels = new Map(
    (Array.isArray(topic.metrics) ? topic.metrics : []).map((d) => [
      d.key,
      d.label,
    ]),
  );

  return [
    {
      label: metricLabels.get("totalAllocated") ?? "Total allocated",
      value: topic.formatters.amount(metrics.totalAllocated),
    },
    {
      label: metricLabels.get("projectCount") ?? "Projects",
      value: formatInteger(metrics.projectCount),
    },
    {
      label: metricLabels.get("organisationCount") ?? "Organisations",
      value: formatInteger(metrics.organisationCount),
    },
    {
      label: metricLabels.get("sportTypeCount") ?? "Sport types",
      value: formatInteger(metrics.sportTypeCount),
    },
  ];
}

export function buildAmountByCategory(rows) {
  return rollupSum(rows, "__category", "__amount");
}

export function buildAmountByYear(rows) {
  return rollupSum(rows, "__year", "__amount").sort((a, b) => {
    const ay = Number(a.key);
    const by = Number(b.key);

    if (Number.isFinite(ay) && Number.isFinite(by)) return ay - by;
    return String(a.key).localeCompare(String(b.key), "en");
  });
}

export function buildTopEntities(rows, limit = 10) {
  return rollupSum(rows, "__entity", "__amount").slice(0, limit);
}

export function buildTopProjects(rows, limit = 10) {
  return rollupSum(rows, "__title", "__amount").slice(0, limit);
}

export function buildDownloadRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((d) => ({
    constituency: d.__constituency ?? "",
    county: d.__county ?? "",
    year: d.__year ?? "",
    organisation: d.__entity ?? "",
    project_title: d.__title ?? "",
    sport_type: d.__category ?? "",
    amount_allocated: Number.isFinite(d.__amount) ? d.__amount : "",
    latitude: Number.isFinite(d.__lat) ? d.__lat : "",
    longitude: Number.isFinite(d.__lon) ? d.__lon : "",
  }));
}

function rollupSum(rows, keyField, valueField) {
  const safeRows = Array.isArray(rows) ? rows : [];

  return Array.from(
    safeRows.reduce((acc, row) => {
      const key = cleanText(row[keyField]);
      const value = toFiniteNumber(row[valueField]) || 0;

      if (!key) return acc;

      acc.set(key, (acc.get(key) || 0) + value);
      return acc;
    }, new Map()),
  )
    .map(([key, value]) => ({ key, value }))
    .sort(
      (a, b) =>
        b.value - a.value || String(a.key).localeCompare(String(b.key), "en"),
    );
}

function safeSum(rows, accessor) {
  return (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
    const value = toFiniteNumber(accessor(row));
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function distinctCount(rows, accessor) {
  return new Set(
    (Array.isArray(rows) ? rows : [])
      .map(accessor)
      .map(cleanText)
      .filter(Boolean),
  ).size;
}

function countNonEmpty(rows, accessor) {
  return (Array.isArray(rows) ? rows : [])
    .map(accessor)
    .map(cleanText)
    .filter(Boolean).length;
}

function maxNumericOrText(values) {
  const cleaned = (Array.isArray(values) ? values : [])
    .map(cleanText)
    .filter(Boolean);

  if (!cleaned.length) return null;

  const numeric = cleaned.map(Number).filter(Number.isFinite);
  if (numeric.length) return String(Math.max(...numeric));

  return cleaned.sort((a, b) => a.localeCompare(b, "en")).at(-1) ?? null;
}

function formatInteger(value) {
  return Number.isFinite(value) ? value.toLocaleString("en-IE") : "—";
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}
