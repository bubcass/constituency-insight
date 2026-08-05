import {chartPalette} from "../../config/chart-palette.js";

export const healthServicesTopic = {
  layers: [
    {value: "health-centre", label: "Health centres", color: chartPalette[0]},
    {value: "hospital", label: "Hospitals", color: chartPalette[1]},
    {value: "gp", label: "GP practices", color: chartPalette[2]},
    {value: "pharmacy", label: "Pharmacies", color: chartPalette[4]},
  ],
  fields: {
    lat: "latitude",
    lon: "longitude",
    amount: "location_count",
    category: "service_label",
    entity: "address",
    title: "name",
  },
  labels: {
    baseLayer: "Health services",
    categoryLegend: "Service type",
    amountLegend: "Service locations",
    visibleCount: "Visible services",
    noRecordsInView: "No health services in view.",
    clearAll: "Deselect all",
    clearAllTitle: "Hide all health service layers",
  },
};

healthServicesTopic.palette = Object.fromEntries(
  healthServicesTopic.layers.map((layer) => [layer.label, layer.color]),
);

export function healthServiceTooltip(point) {
  const escape = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  const type = point.service_type ?? point.type;
  const label = {
    "health-centre": "Health centre",
    hospital: point.subtype ? `${point.subtype} hospital` : "Hospital",
    gp: "GP practice",
    pharmacy: "Pharmacy",
  }[type] ?? "Health service";
  const practitionerCount = Number(point.practitioner_count ?? point.practitionerCount);
  const practitionerLine = type === "gp" && practitionerCount > 0
    ? `<br>${practitionerCount.toLocaleString("en-IE")} ${practitionerCount === 1 ? "GP listed" : "GPs listed"}`
    : "";
  return `<strong>${escape(point.name || label)}</strong><br>${escape(label)}${practitionerLine}${point.address ? `<br>${escape(point.address)}` : ""}`;
}
