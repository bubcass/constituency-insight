import L from "npm:leaflet";

const BLANK_TILE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

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

    .leaflet-control-fullscreen.leaflet-bar a {
      width: 34px;
      height: 34px;
      line-height: 34px;
      text-align: center;
      font-size: 18px;
      text-decoration: none;
      background: #fff;
    }

    .constituency-map:fullscreen {
      width: 100vw !important;
      height: 100vh !important;
    }

    .constituency-map:-webkit-full-screen {
      width: 100vw !important;
      height: 100vh !important;
    }

    .constituency-map.is-fs {
      position: fixed !important;
      inset: 0;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 10000;
      background: #fff;
    }
  `;
  container.appendChild(cleanupStyle);

  const map = L.map(container, {
    zoomControl: false,
  });

  map.attributionControl.setPrefix(
    '<a href="https://leafletjs.com">Leaflet</a>',
  );

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    errorTileUrl: BLANK_TILE,
    detectRetina: true,
  }).addTo(map);

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

  const FullscreenControl = L.Control.extend({
    options: { position: "bottomright" },
    onAdd: () => {
      const ctl = L.DomUtil.create(
        "div",
        "leaflet-control-fullscreen leaflet-bar",
      );
      const link = L.DomUtil.create("a", "", ctl);
      link.href = "#";
      link.title = "Toggle fullscreen";
      link.setAttribute("aria-label", "Toggle fullscreen");
      link.innerHTML = "⛶";

      const isFsAPI = () =>
        document.fullscreenElement === container ||
        document.webkitFullscreenElement === container;

      const enterFsAPI = async () => {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
          container.webkitRequestFullscreen();
        }
      };

      const exitFsAPI = async () => {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      };

      let fallbackActive = false;

      const enterFallback = () => {
        fallbackActive = true;
        container.classList.add("is-fs");
        document.body.style.overflow = "hidden";
        setTimeout(() => map.invalidateSize(), 50);
      };

      const exitFallback = () => {
        fallbackActive = false;
        container.classList.remove("is-fs");
        document.body.style.overflow = "";
        setTimeout(() => map.invalidateSize(), 50);
      };

      L.DomEvent.on(link, "click", (e) => {
        L.DomEvent.stop(e);
        (async () => {
          try {
            if (isFsAPI()) {
              await exitFsAPI();
            } else {
              await enterFsAPI();
            }
          } catch {
            if (fallbackActive) exitFallback();
            else enterFallback();
          }
        })();
      });

      ["fullscreenchange", "webkitfullscreenchange"].forEach((ev) => {
        document.addEventListener(ev, () => {
          setTimeout(() => map.invalidateSize(), 50);
        });
      });

      return ctl;
    },
  });

  new FullscreenControl().addTo(map);

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

  return container;
}
