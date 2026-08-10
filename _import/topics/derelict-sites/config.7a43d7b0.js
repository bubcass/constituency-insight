export const derelictSitesTopic = {
  fields: {
    lat: "latitude",
    lon: "longitude",
    amount: "site_count",
    category: "location_category",
    year: "source_date",
    entity: "local_authority",
    title: "register_reference",
  },

  labels: {
    baseLayer: "Derelict sites",
    categoryLegend: "Location evidence",
    amountLegend: "Registered sites",
    visibleCount: "Visible registered sites",
    noRecordsInView: "No mapped register records in view.",
    clearAll: "Deselect all",
    clearAllTitle: "Hide all location-evidence layers",
  },

  palette: {
    "Authority point": "#9f1d20",
    "Polygon centroid": "#d47a2f",
    "Transformed grid reference": "#7f6c2e",
    "Other authority location": "#777777",
  },

  formatCount(value) {
    return Number.isFinite(Number(value))
      ? new Intl.NumberFormat("en-IE", {maximumFractionDigits: 0}).format(Number(value))
      : "—";
  },

  tooltipHTML(record, {escapeHtml}) {
    const entered = formatDate(record.date_entered);
    const provenance = {
      "Authority point": "Point published by the local authority",
      "Polygon centroid": "Centroid calculated from an authority polygon",
      "Transformed grid reference": "Authority grid reference transformed to WGS84",
    }[record.location_category] ?? "Authority-supplied location";
    return `
      <div><strong>${escapeHtml(record.address_or_description || "Registered site")}</strong></div>
      <div>${escapeHtml(record.local_authority)}</div>
      <div><strong>Reference:</strong> ${escapeHtml(record.register_reference || "Not published")}</div>
      ${record.eircode ? `<div><strong>Eircode:</strong> ${escapeHtml(record.eircode)}</div>` : ""}
      ${entered ? `<div><strong>Entered:</strong> ${escapeHtml(entered)}</div>` : ""}
      <div><em>${escapeHtml(provenance)}</em></div>
      <div><em>Click for the official source.</em></div>
    `;
  },

  popupHTML(record, {escapeHtml}) {
    const url = safeHttpUrl(record.source_url);
    return `
      <div class="topic-map-popup">
        <strong>${escapeHtml(record.address_or_description || "Registered site")}</strong>
        <p>${escapeHtml(record.local_authority)}</p>
        <p><strong>Reference:</strong> ${escapeHtml(record.register_reference || "Not published")}</p>
        ${url ? `<p><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Open the official register source</a></p>` : ""}
      </div>
    `;
  },
};

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-IE", {day: "numeric", month: "short", year: "numeric", timeZone: "UTC"}).format(date);
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
