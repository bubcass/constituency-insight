import L from "npm:leaflet";
import { chartColors } from "../config/chart-palette.js";
import {
  addStandardBaseLayer,
  addStandardMapControls,
} from "./leaflet-map-ui.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function defaultPointTooltip(point) {
  if (point.type === "station") {
    return `<strong>${escapeHtml(point.name || "Rail station")}</strong><br>Rail station`;
  }
  if (point.type === "luas") {
    return `<strong>${escapeHtml(point.name || "Luas stop")}</strong><br>Luas stop`;
  }
  const indicator = point.indicator ? ` · ${escapeHtml(point.indicator)}` : "";
  return `<strong>${escapeHtml(point.name || "Bus stop")}</strong>${indicator}`;
}

function pointAccessibleLabel(point) {
  const name = String(point?.name ?? "").trim();
  if (point?.type === "station") return name ? `Rail station: ${name}` : "Rail station";
  if (point?.type === "luas") return name ? `Luas stop: ${name}` : "Luas stop";
  return name ? `Bus stop: ${name}` : "Bus stop";
}

export function electoralDistrictMap({
  constituencyGeoJSON,
  districtGeoJSON,
  selectedGuid = "all",
  height = 500,
  fitMaxZoom = 10,
  onSelect = () => {},
  points = [],
  lines = [],
  enabledFeatureTypes = new Set(["bus", "station", "luas", "rail"]),
  pointTypeStyles = {
    bus: {color: chartColors.blue, fillColor: chartColors.blue, radius: 4},
    station: {color: chartColors.brown, fillColor: chartColors.red, shape: "diamond"},
    luas: {color: "#ffffff", fillColor: chartColors.purple, radius: 6, weight: 2},
  },
  pointTooltipHTML = defaultPointTooltip,
} = {}) {
  let currentSelectedGuid = selectedGuid;
  let currentFeatureTypes = new Set(enabledFeatureTypes);
  const container = document.createElement("div");
  container.className = "topic-map demographics-map";
  container.style.height = `${height}px`;
  container.style.position = "relative";
  container.style.width = "100%";
  container.style.fontFamily = '"IBM Plex Sans", sans-serif';

  const style = document.createElement("style");
  style.textContent = `
    .demographics-map .leaflet-pane > svg,
    .demographics-map .leaflet-overlay-pane svg {
      width: auto !important;
      height: auto !important;
      max-width: none !important;
      overflow: visible;
    }

    .demographics-map .leaflet-attribution-flag {
      width: 12px !important;
      height: 8px !important;
    }

    .demographics-map .leaflet-interactive {
      vector-effect: non-scaling-stroke;
    }

    .demographics-map .transport-station-marker {
      position: relative;
      display: block;
      width: 16px;
      height: 16px;
      border: 3px solid #ffffff;
      border-radius: 2px;
      background: var(--marker-fill);
      box-shadow: 0 0 0 2px var(--marker-stroke), 0 2px 6px rgba(0, 0, 0, 0.34);
      transform: rotate(45deg);
    }

    .demographics-map .transport-station-marker::after {
      position: absolute;
      inset: 4px;
      border-radius: 50%;
      background: #ffffff;
      content: "";
    }
  `;
  container.appendChild(style);

  const map = L.map(container, { zoomControl: true, scrollWheelZoom: true });
  addStandardBaseLayer(map);
  const mapUi = addStandardMapControls(map, container, {
    scrollWheelZoom: true,
    fullscreen: true,
  });

  const constituencyLayer = L.geoJSON(constituencyGeoJSON, {
    interactive: false,
    style: {
      fillColor: "#7f6c2e",
      fillOpacity: 0.07,
      color: "#66551f",
      opacity: 1,
      weight: 2.4,
    },
  }).addTo(map);

  let selectedLayer = null;

  function districtStyle(feature) {
    const active = feature?.properties?.ED_GUID === currentSelectedGuid;
    return {
      fillColor: active ? chartColors.orange : chartColors.blue,
      fillOpacity: active ? 0.58 : 0.11,
      color: active ? chartColors.brown : chartColors.grey,
      opacity: active ? 1 : 0.72,
      weight: active ? 2.6 : 0.75,
    };
  }

  function selectFeature(feature) {
    onSelect(feature?.properties?.ED_GUID ?? "all");
  }

  const districtLayer = L.geoJSON(districtGeoJSON, {
    style: districtStyle,
    onEachFeature(feature, featureLayer) {
      const name = feature?.properties?.ED_NAME ?? "Electoral district";
      const active = feature?.properties?.ED_GUID === currentSelectedGuid;
      if (active) selectedLayer = featureLayer;

      featureLayer.bindTooltip(`${name} · Click to view`, {
        sticky: true,
        direction: "top",
        className: "demographics-map__tooltip",
      });
      featureLayer.on("click", () => selectFeature(feature));
      featureLayer.on("mouseover", () => {
        if (feature?.properties?.ED_GUID !== currentSelectedGuid) {
          featureLayer.setStyle({fillOpacity: 0.28, weight: 1.35, opacity: 0.95});
        }
      });
      featureLayer.on("mouseout", () => {
        featureLayer.setStyle(districtStyle(feature));
      });
      featureLayer.on("add", () => {
        const path = featureLayer.getElement();
        if (!path) return;
        path.setAttribute("tabindex", "0");
        path.setAttribute("role", "button");
        path.setAttribute("aria-label", `${name}, electoral district. Select to filter the demographic view.`);
        path.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          selectFeature(feature);
        });
      });
    },
  }).addTo(map);

  districtLayer.bringToFront();

  map.createPane("transportRailLines");
  map.getPane("transportRailLines").style.zIndex = 610;
  map.createPane("transportAccessPoints");
  map.getPane("transportAccessPoints").style.zIndex = 620;
  const railLayer = L.geoJSON(null, {
    pane: "transportRailLines",
    interactive: false,
    style: {
      pane: "transportRailLines",
      color: chartColors.grey,
      opacity: 0.56,
      weight: 1.6,
    },
  }).addTo(map);
  const pointRenderer = L.canvas({pane: "transportAccessPoints", padding: 0.5});
  const pointLayers = new Map();
  const pointRecords = (Array.isArray(points) ? points : [])
    .map((point) => ({
      ...point,
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
    }))
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));

  for (const point of pointRecords) {
    if (!pointLayers.has(point.type)) pointLayers.set(point.type, L.layerGroup().addTo(map));
    const style = pointTypeStyles[point.type] ?? {};
    const accessibleLabel = pointAccessibleLabel(point);
    point.__marker = style.shape === "diamond"
      ? L.marker([point.latitude, point.longitude], {
          pane: "transportAccessPoints",
          title: accessibleLabel,
          icon: L.divIcon({
            className: "transport-station-div-icon",
            html: `<span class="transport-station-marker" style="--marker-fill: ${style.fillColor}; --marker-stroke: ${style.color}" aria-hidden="true"></span>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
        })
      : L.circleMarker([point.latitude, point.longitude], {
          renderer: pointRenderer,
          pane: "transportAccessPoints",
          radius: style.radius ?? 4.5,
          color: style.color ?? "#4d4d4d",
          fillColor: style.fillColor ?? style.color ?? "#777777",
          fillOpacity: style.fillOpacity ?? 0.9,
          opacity: 1,
          weight: style.weight ?? 1.25,
        });
    if (style.shape === "diamond") {
      point.__marker.on("add", () => {
        point.__marker.getElement()?.setAttribute("aria-label", accessibleLabel);
      });
    }
    point.__marker.bindTooltip(pointTooltipHTML(point), {
      direction: "top",
      sticky: true,
      opacity: 0.97,
      className: "transport-access-tooltip",
      offset: [0, -4],
    });
  }

  const lineRecords = (Array.isArray(lines) ? lines : [])
    .filter((line) => line?.geometry && line.type);

  function refreshFeatures() {
    pointLayers.forEach((layer) => layer.clearLayers());
    for (const point of pointRecords) {
      if (!currentFeatureTypes.has(point.type)) continue;
      if (currentSelectedGuid !== "all" && point.edGuid !== currentSelectedGuid) continue;
      pointLayers.get(point.type)?.addLayer(point.__marker);
    }

    railLayer.clearLayers();
    if (currentFeatureTypes.has("rail")) {
      railLayer.addData({
        type: "FeatureCollection",
        features: lineRecords
          .filter((line) => currentSelectedGuid === "all" || line.edGuid === currentSelectedGuid)
          .map((line) => ({
            type: "Feature",
            properties: {id: line.id, edGuid: line.edGuid, edName: line.edName},
            geometry: line.geometry,
          })),
      });
    }
  }

  refreshFeatures();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      map.invalidateSize();

      const targetBounds = constituencyLayer.getBounds().isValid()
        ? constituencyLayer.getBounds()
        : districtLayer.getBounds();

      if (targetBounds.isValid()) {
        map.fitBounds(targetBounds, {
          padding: [34, 34],
          maxZoom: fitMaxZoom,
        });
      }
    });
  });

  container.setSelectedGuid = (guid = "all") => {
    currentSelectedGuid = guid;
    selectedLayer = null;

    districtLayer.eachLayer((featureLayer) => {
      featureLayer.setStyle(districtStyle(featureLayer.feature));
      if (featureLayer.feature?.properties?.ED_GUID === currentSelectedGuid) {
        selectedLayer = featureLayer;
      }
    });

    if (selectedLayer) selectedLayer.bringToFront();
    else districtLayer.bringToFront();
    refreshFeatures();
  };

  container.setEnabledFeatureTypes = (types = []) => {
    currentFeatureTypes = new Set(types);
    refreshFeatures();
  };

  container.destroy = () => {
    mapUi.destroy();
    map.remove();
  };

  return container;
}
