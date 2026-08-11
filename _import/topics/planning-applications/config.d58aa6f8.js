import {categoryColorMap} from "../../config/chart-palette.7185253a.js";

export const planningApplicationsTopic = {
  fields: {
    lat: "latitude",
    lon: "longitude",
    amount: "marker_weight",
    category: "development_type",
    year: "year",
    entity: "planning_authority",
    title: "application_number"
  },

  labels: {
    baseLayer: "Planning applications",
    categoryLegend: "Development type",
    amountLegend: "Residential units reported",
    visibleCount: "Visible applications",
    noRecordsInView: "No housing planning applications in view.",
    clearAll: "Deselect all",
    clearAllTitle: "Hide all development types"
  },

  palette: categoryColorMap([
    "New dwelling / one-off house",
    "New multi-unit housing",
    "Extension / alteration",
    "Change of use to housing",
    "Retention / regularisation",
    "Revision / amendment",
    "Domestic ancillary",
    "Other residential",
  ]),

  formatCount(value) {
    return Number.isFinite(Number(value))
      ? new Intl.NumberFormat("en-IE", {maximumFractionDigits: 0}).format(
          Number(value)
        )
      : "—";
  },

  tooltipHTML(record, {escapeHtml}) {
    const units = Number(record.residential_units_reported);
    const unitText = units > 0
      ? `${planningApplicationsTopic.formatCount(units)} residential ${units === 1 ? "unit" : "units"} reported`
      : "Residential unit count not reported";
    const decision =
      record.decision || record.application_status || "Status unavailable";

    return `
      <div><strong>${escapeHtml(record.development_type)}</strong></div>
      <div>${escapeHtml(formatDate(record.received_date))} · ${escapeHtml(record.planning_authority)}</div>
      <div>${escapeHtml(record.development_address || "Address unavailable")}</div>
      <div>${escapeHtml(unitText)} · ${escapeHtml(decision)}</div>
      <div><strong>Reference:</strong> ${escapeHtml(record.application_number)}</div>
      <div><em>Click for the planning record.</em></div>
    `;
  },

  popupHTML(record, {escapeHtml}) {
    const url = safeHttpUrl(record.application_details_url);
    const linkLabel = record.application_link_type === "authority search"
      ? "Search the authority’s planning records"
      : "Open the full planning application";

    return `
      <div class="topic-map-popup">
        <strong>${escapeHtml(record.development_type)}</strong>
        <p>${escapeHtml(record.development_address || "Address unavailable")}</p>
        <p><strong>Reference:</strong> ${escapeHtml(record.application_number)}</p>
        ${url
          ? `<p><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(linkLabel)}</a></p>`
          : ""}
      </div>
    `;
  }
};

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return String(value ?? "");
  return new Intl.DateTimeFormat("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
