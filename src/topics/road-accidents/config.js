export const roadAccidentsTopic = {
  fields: {
    lat: "latitude",
    lon: "longitude",
    amount: "casualty_count",
    category: "incident_type",
    year: "year",
    entity: "constituency",
    title: "incident_id",
  },

  labels: {
    baseLayer: "Road collisions",
    categoryLegend: "Incident severity",
    amountLegend: "People injured or killed",
    visibleCount: "Visible incidents",
    noRecordsInView: "No incidents in view.",
    clearAll: "Deselect all",
    clearAllTitle: "Hide all incident layers",
  },

  palette: {
    Fatal: "#9f1d20",
    Serious: "#e47726",
    "Non-serious": "#e5b94c",
    Unknown: "#777777",
  },

  roadUserFilters: [
    { key: "cyclists", label: "Cyclists", test: (record) => Number(record.cyclist_count) > 0 },
    { key: "drivers", label: "Drivers", test: (record) => Number(record.driver_count) > 0 },
    { key: "e-scooter-other", label: "E-scooter/other", test: (record) => Number(record.e_scooter_other_count) > 0 },
    { key: "motorcyclists", label: "Motorcyclists", test: (record) => Number(record.motorcyclist_count) > 0 },
    { key: "passengers", label: "Passengers", test: (record) => Number(record.passenger_count) > 0 },
    { key: "pedestrians", label: "Pedestrians", test: (record) => Number(record.pedestrian_count) > 0 },
  ],

  roadUserPalette: {
    Drivers: "#2678a8",
    Passengers: "#755894",
    Pedestrians: "#b84d45",
    Cyclists: "#2f8b68",
    Motorcyclists: "#d47a2f",
    "E-scooter/other": "#9b8738",
  },

  formatCount(value) {
    return Number.isFinite(value)
      ? new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 }).format(value)
      : "—";
  },

  tooltipHTML(record, { escapeHtml }) {
    const casualtySummary = [
      ["Fatalities", record.fatality_count],
      ["Serious injuries", record.serious_injury_count],
      ["Non-serious injuries", record.non_serious_injury_count],
    ]
      .filter(([, value]) => Number(value) > 0)
      .map(([label, value]) => `${label}: ${value}`)
      .join(" · ");
    const roadUserSummary = [
      ["Cyclists", record.cyclist_count],
      ["Drivers", record.driver_count],
      ["E-scooter/other", record.e_scooter_other_count],
      ["Motorcyclists", record.motorcyclist_count],
      ["Passengers", record.passenger_count],
      ["Pedestrians", record.pedestrian_count],
    ]
      .filter(([, value]) => Number(value) > 0)
      .map(([label, value]) => `${label}: ${value}`)
      .join(" · ");

    return `
      <div><strong>${escapeHtml(record.__category)} collision</strong></div>
      <div>${escapeHtml(formatIncidentMonth(record.date))} · ${escapeHtml(record.time_band)}</div>
      <div>${escapeHtml(casualtySummary || "No casualty breakdown recorded")}</div>
      <div>${escapeHtml(roadUserSummary || "Road-user type not recorded")}</div>
      <div><strong>Incident ID:</strong> ${escapeHtml(record.incident_id)}</div>
    `;
  },
};

function formatIncidentMonth(value) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return String(value ?? "");
  return new Intl.DateTimeFormat("en-IE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
