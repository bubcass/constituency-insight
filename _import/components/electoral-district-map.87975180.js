import L from "../../_npm/leaflet@1.9.4/721623d8.js";
import { chartColors } from "../config/chart-palette.dbce5681.js";
import {
  addStandardBaseLayer,
  addStandardMapControls,
} from "./leaflet-map-ui.4fd45fb1.js";

export function electoralDistrictMap({
  constituencyGeoJSON,
  districtGeoJSON,
  selectedGuid = "all",
  height = 500,
  onSelect = () => {},
} = {}) {
  let currentSelectedGuid = selectedGuid;
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

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      map.invalidateSize();

      const targetBounds = constituencyLayer.getBounds().isValid()
        ? constituencyLayer.getBounds()
        : districtLayer.getBounds();

      if (targetBounds.isValid()) {
        map.fitBounds(targetBounds, {
          padding: [34, 34],
          maxZoom: 10,
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
  };

  container.destroy = () => {
    mapUi.destroy();
    map.remove();
  };

  return container;
}
