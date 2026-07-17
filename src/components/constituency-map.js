import L from "npm:leaflet";
import {
  addStandardBaseLayer,
  addStandardMapControls,
} from "./leaflet-map-ui.js";

function cleanConstituencyLabel(name) {
  return String(name ?? "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .trim();
}

function constituencyStyle() {
  return {
    fillColor: "#7f6c2e",
    weight: 2,
    opacity: 1,
    color: "#8a8a8a",
    dashArray: 1,
    fillOpacity: 0.16,
  };
}

export function constituencyMap(featureCollection, options = {}) {
  const {
    height = 540,
    popupFormatter = (feature) => {
      const raw = feature?.properties?.ENG_NAME_VALUE ?? "Constituency";
      const cleaned = cleanConstituencyLabel(raw);
      return `This is the <strong>${cleaned}</strong> constituency.`;
    },
  } = options;

  const container = document.createElement("div");
  container.className = "constituency-map";
  container.style.height = `${height}px`;
  container.style.width = "100%";
  container.style.position = "relative";

  const cleanupStyle = document.createElement("style");
  cleanupStyle.textContent = `
    .leaflet-default-icon-path {
      display: none !important;
    }
    .leaflet-pane > svg,
    .leaflet-overlay-pane svg {
      overflow: visible;
    }
    .leaflet-interactive {
      vector-effect: non-scaling-stroke;
    }

  `;
  container.appendChild(cleanupStyle);

  const map = L.map(container, {
    zoomControl: true,
    scrollWheelZoom: true,
  });
  addStandardBaseLayer(map);
  const mapUi = addStandardMapControls(map, container, {
    scrollWheelZoom: true,
    fullscreen: true,
  });

  const geoLayer = L.geoJSON(featureCollection, {
    renderer: L.svg(),
    style: constituencyStyle,
    onEachFeature(feature, layer) {
      layer.bindPopup(popupFormatter(feature), {
        minWidth: 190,
        maxWidth: 240,
      });
    },
  }).addTo(map);

  const layers = geoLayer.getLayers();

  if (layers.length > 0) {
    layers.forEach((layer) => {
      if (layer.setStyle) layer.setStyle(constituencyStyle());
      if (layer.bringToFront) layer.bringToFront();
    });

    requestAnimationFrame(() => {
      map.invalidateSize();

      const bounds = geoLayer.getBounds();

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [28, 28],
          maxZoom: 11,
        });
      }

      const firstLayer = layers[0];
      if (firstLayer) firstLayer.openPopup();
    });
  } else {
    requestAnimationFrame(() => {
      map.invalidateSize();
      map.setView([53.4, -8.0], 6);
    });
  }

  container.destroy = () => {
    mapUi.destroy();
    map.remove();
  };

  return container;
}
