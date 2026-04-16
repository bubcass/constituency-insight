import L from "npm:leaflet";
import * as d3 from "npm:d3";
import * as turf from "npm:@turf/turf";

const BLANK_TILE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

function toNumber(value) {
  if (typeof value === "number") return value;
  return Number(
    String(value ?? "")
      .replace(/[€$,]/g, "")
      .trim(),
  );
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function defaultTooltipHTML(record, { formatAmount }) {
  return `
    <div><strong>${escapeHtml(record.__category)} | ${escapeHtml(formatAmount(record.__amount))}</strong></div>
    <div><em>${escapeHtml(record.__entity ?? "—")}</em></div>
    <div><strong>Project: </strong>${escapeHtml(record.__title ?? "—")}</div>
    <div><strong>Year: </strong>${escapeHtml(record.__year ?? "—")}</div>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function polygonsOnly(input) {
  const out = [];

  const visit = (obj, props = {}) => {
    if (!obj) return;

    switch (obj.type) {
      case "FeatureCollection":
        obj.features?.forEach((f) => visit(f));
        break;
      case "Feature":
        visit(obj.geometry, obj.properties || {});
        break;
      case "GeometryCollection":
        (obj.geometries || []).forEach((g) => visit(g, props));
        break;
      case "Polygon":
        out.push(turf.polygon(obj.coordinates, props));
        break;
      case "MultiPolygon":
        out.push(turf.multiPolygon(obj.coordinates, props));
        break;
    }
  };

  visit(input);
  return out;
}

function buildCategoryColorResolver(categories, palette) {
  const fallbackPalette = [
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
    "#bcbd22",
    "#17becf",
  ];

  if (palette instanceof Map) {
    const ordinal = d3.scaleOrdinal().domain(categories).range(fallbackPalette);
    return (category) => palette.get(category) ?? ordinal(category);
  }

  if (palette && !Array.isArray(palette) && typeof palette === "object") {
    const ordinal = d3.scaleOrdinal().domain(categories).range(fallbackPalette);
    return (category) => palette[category] ?? ordinal(category);
  }

  const paletteArray =
    Array.isArray(palette) && palette.length ? palette : fallbackPalette;

  const ordinal = d3.scaleOrdinal().domain(categories).range(paletteArray);
  return (category) => ordinal(category);
}

export function topicPointMap({
  constituencyGeoJSON,
  data = [],
  height = 500,
  palette = [
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
    "#bcbd22",
    "#17becf",
  ],
  fields = {
    lat: "__lat",
    lon: "__lon",
    amount: "__amount",
    category: "__category",
    year: "__year",
    entity: "__entity",
    title: "__title",
  },
  labels = {
    baseLayer: "Map",
    categoryLegend: "Category",
    amountLegend: "Amount",
    visibleCount: "Visible records",
    noRecordsInView: "No records in view.",
    clearAll: "Deselect all",
    clearAllTitle: "Hide all category layers",
    locateMe: "Locate me",
    locateTitle: "Show my current location",
    locationInside: "You appear to be inside this constituency.",
    locationOutside: "You appear to be outside this constituency.",
    locationUnavailable: "Location unavailable.",
  },
  boundaryStyle = {
    fillColor: "#7f6c2e",
    weight: 2,
    opacity: 1,
    color: "#8a8a8a",
    fillOpacity: 0.16,
  },
  bufferMetres = 10,
  tooltipHTML = defaultTooltipHTML,
  amountFormatter = (v) =>
    Number.isFinite(v)
      ? new Intl.NumberFormat("en-IE", {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0,
        }).format(v)
      : "—",
  enableGeolocation = true,
  onLocate = null,
} = {}) {
  const container = document.createElement("div");
  container.className = "topic-map";
  container.style.height = `${height}px`;
  container.style.position = "relative";
  container.style.width = "100%";
  container.style.fontFamily = '"IBM Plex Sans", sans-serif';

  const style = document.createElement("style");
  style.textContent = `
    .grant-tooltip.leaflet-tooltip,
    .topic-map-tooltip.leaflet-tooltip {
      pointer-events: none;
      font: 12px/1.2 "IBM Plex Sans", sans-serif;
      box-shadow: 0 1px 3px rgba(0,0,0,0.25);
      border: 1px solid rgba(0,0,0,0.2);
      background: white;
      z-index: 660;
    }

    .topic-map-legend {
      z-index: 2000;
      font-family: "IBM Plex Sans", sans-serif;
    }

    .topic-map-legend summary {
      list-style: none;
    }

    .topic-map-legend summary::-webkit-details-marker {
      display: none;
    }

    .leaflet-control-fullscreen.leaflet-bar a,
    .leaflet-control-geolocate.leaflet-bar button {
      width: 34px;
      height: 34px;
      line-height: 34px;
      text-align: center;
      font-size: 18px;
      text-decoration: none;
      background: #fff;
      font-family: "IBM Plex Sans", sans-serif;
      border: 0;
      padding: 0;
      cursor: pointer;
      display: block;
    }

    .leaflet-control-geolocate.leaflet-bar button:hover {
      background: #f5f5f5;
    }

    .topic-map:fullscreen {
      width: 100vw !important;
      height: 100vh !important;
    }

    .topic-map:-webkit-full-screen {
      width: 100vw !important;
      height: 100vh !important;
    }

    .topic-map.is-fs {
      position: fixed !important;
      inset: 0;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 10000;
      background: #fff;
    }
  `;
  container.appendChild(style);

  const map = L.map(container);

  map.attributionControl
    .setPrefix
    //'<a href="https://leafletjs.com">Leaflet</a>',
    ();

  const osm = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      //attribution: "© OpenStreetMap contributors",
      detectRetina: true,
      errorTileUrl: BLANK_TILE,
    },
  ).addTo(map);

  const boundaryLayer = L.geoJSON(constituencyGeoJSON, {
    style: boundaryStyle,
  }).addTo(map);

  if (boundaryLayer.getBounds().isValid()) {
    map.fitBounds(boundaryLayer.getBounds(), { maxZoom: 19 });
  }

  let polygons = polygonsOnly(boundaryLayer.toGeoJSON());

  if (bufferMetres > 0 && polygons.length) {
    polygons = polygons.map((p) =>
      turf.buffer(p, bufferMetres, { units: "meters" }),
    );
  }

  let records = (Array.isArray(data) ? data : [])
    .map((d) => ({
      ...d,
      __lat: +d[fields.lat],
      __lon: +d[fields.lon],
      __amount: toNumber(d[fields.amount]),
      __category: cleanText(d[fields.category]) || "Unspecified",
      __year: cleanText(d[fields.year]),
      __entity: cleanText(d[fields.entity]),
      __title: cleanText(d[fields.title]),
      __raw: d,
    }))
    .filter((d) => Number.isFinite(d.__lat) && Number.isFinite(d.__lon));

  if (polygons.length) {
    const [minX, minY, maxX, maxY] = turf.bbox(
      turf.featureCollection(polygons),
    );

    records = records.filter((d) => {
      if (
        d.__lon < minX ||
        d.__lon > maxX ||
        d.__lat < minY ||
        d.__lat > maxY
      ) {
        return false;
      }
      const pt = turf.point([d.__lon, d.__lat]);
      return polygons.some((poly) => turf.booleanPointInPolygon(pt, poly));
    });
  }

  const amountsAll = records.map((d) => d.__amount).filter(Number.isFinite);
  const [aMinAll, aMaxAll] = d3.extent(amountsAll);
  const size = d3
    .scaleSqrt()
    .domain([aMinAll || 0, aMaxAll || 1])
    .range([3, 14]);

  const categoriesAll = Array.from(
    new Set(records.map((d) => String(d.__category)).filter(Boolean)),
  );

  const getCategoryColor = buildCategoryColorResolver(categoriesAll, palette);

  map.createPane("markers");
  map.getPane("markers").style.zIndex = 620;

  const categoryLayers = new Map();
  const layerToCategory = new Map();

  categoriesAll.forEach((category) => {
    const group = L.layerGroup().addTo(map);
    categoryLayers.set(category, group);
    layerToCategory.set(group, category);
  });

  records.forEach((d) => {
    const fill = getCategoryColor(d.__category);
    const stroke = (() => {
      const c = d3.color(fill);
      return c && c.darker ? c.darker(0.6).formatHex() : fill;
    })();

    const marker = L.circleMarker([d.__lat, d.__lon], {
      pane: "markers",
      radius: size(d.__amount) || 6,
      color: stroke,
      fillColor: fill,
      fillOpacity: 0.9,
      weight: 1.25,
    }).bindTooltip(
      tooltipHTML(d, {
        formatAmount: amountFormatter,
        escapeHtml,
      }),
      {
        direction: "top",
        sticky: true,
        opacity: 0.96,
        className: "topic-map-tooltip",
        offset: [0, -4],
      },
    );

    categoryLayers.get(d.__category)?.addLayer(marker);
  });

  const overlays = {};
  categoriesAll.forEach((category) => {
    overlays[category] = categoryLayers.get(category);
  });

  const layersCtl = L.control
    .layers({ [labels.baseLayer]: osm }, overlays, { collapsed: true })
    .addTo(map);

  const ctlContainer = layersCtl.getContainer
    ? layersCtl.getContainer()
    : layersCtl._container;

  const overlayBox = ctlContainer.querySelector(
    ".leaflet-control-layers-overlays",
  );

  if (overlayBox) {
    const bar = document.createElement("div");
    bar.style.cssText =
      "display:flex; justify-content:flex-end; margin:4px 0 6px;";

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.textContent = labels.clearAll;
    clearBtn.title = labels.clearAllTitle;
    clearBtn.style.cssText = `
      background:#f8f8f8; border:1px solid #ddd; border-radius:6px;
      padding:3px 6px; font-size:12px; cursor:pointer;
      font-family:"IBM Plex Sans", sans-serif;
    `;

    bar.appendChild(clearBtn);
    overlayBox.prepend(bar);

    L.DomEvent.disableClickPropagation(bar);
    L.DomEvent.disableScrollPropagation(bar);

    L.DomEvent.on(clearBtn, "click", (e) => {
      L.DomEvent.stop(e);
      overlayBox
        .querySelectorAll("input.leaflet-control-layers-selector")
        .forEach((inp) => {
          if (inp.checked) inp.click();
        });
      scheduleUpdate();
    });
  }

  let enabledCategories = new Set(categoriesAll);

  map.on("overlayadd", (e) => {
    const category = layerToCategory.get(e.layer);
    if (category) {
      enabledCategories.add(category);
      scheduleUpdate();
    }
  });

  map.on("overlayremove", (e) => {
    const category = layerToCategory.get(e.layer);
    if (category) {
      enabledCategories.delete(category);
      scheduleUpdate();
    }
  });

  const isMobile = window.matchMedia("(max-width: 640px)").matches;

  let listEl;
  let extraEl;
  let toggleBtn;
  let sizeRowEl;

  const LegendControl = L.Control.extend({
    options: { position: "bottomleft" },
    onAdd: () => {
      const div = L.DomUtil.create("div", "topic-map-legend leaflet-control");
      div.style.cssText = `
        background: rgba(255,255,255,0.95);
        padding: 6px 8px;
        border-radius: 8px;
        font: 10px/1.3 "IBM Plex Sans", sans-serif;
        box-shadow: 0 1px 3px rgba(0,0,0,0.18);
        max-width: 208px; z-index: 2000;
      `;

      const detailsEl = document.createElement("details");
      detailsEl.open = !isMobile;

      const summary = document.createElement("summary");
      summary.textContent = "Legend";
      summary.style.cssText =
        "cursor:pointer; font-weight:600; outline:none; font-size:11px; font-family:'IBM Plex Sans', sans-serif;";
      detailsEl.appendChild(summary);

      const content = document.createElement("div");
      content.style.cssText = isMobile
        ? "max-height: 200px; overflow:auto; margin-top:6px;"
        : "max-height: 240px; overflow:auto; margin-top:6px;";

      const colorBox = document.createElement("div");
      colorBox.innerHTML = `<div style="font-weight:600; margin-bottom:4px; font-family:'IBM Plex Sans', sans-serif;">${escapeHtml(labels.categoryLegend)} (in view)</div>`;

      listEl = document.createElement("div");
      extraEl = document.createElement("div");
      extraEl.style.display = "none";

      toggleBtn = document.createElement("button");
      toggleBtn.style.cssText = `
        margin-top:4px; background:#f5f5f5; border:1px solid #ddd; border-radius:6px;
        padding:3px 5px; font-size:10px; cursor:pointer; display:none;
        font-family:"IBM Plex Sans", sans-serif;
      `;
      toggleBtn.addEventListener("click", () => {
        const shown = extraEl.style.display !== "none";
        extraEl.style.display = shown ? "none" : "block";
        toggleBtn.textContent = shown ? toggleBtn._showText : "Show less";
      });

      colorBox.appendChild(listEl);
      colorBox.appendChild(toggleBtn);
      colorBox.appendChild(extraEl);

      const sizeBox = document.createElement("div");
      sizeBox.style.cssText = "margin-top:8px;";
      sizeBox.innerHTML = `<div style="font-weight:600; margin-bottom:4px; font-family:'IBM Plex Sans', sans-serif;">${escapeHtml(labels.amountLegend)} (in view)</div>`;

      sizeRowEl = document.createElement("div");
      sizeRowEl.style.cssText =
        "display:flex; flex-direction:column; align-items:flex-start; gap:4px;";
      sizeBox.appendChild(sizeRowEl);

      content.appendChild(colorBox);
      content.appendChild(sizeBox);
      detailsEl.appendChild(content);
      div.appendChild(detailsEl);

      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);

      return div;
    },
  });

  new LegendControl().addTo(map);

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function recordsInView() {
    const bounds = map.getBounds();

    return records.filter(
      (d) =>
        enabledCategories.has(d.__category) &&
        bounds.contains(L.latLng(d.__lat, d.__lon)),
    );
  }

  function renderLegendFor(recordsInViewArr) {
    const totalsByCategory = d3.rollup(
      recordsInViewArr,
      (v) => d3.sum(v, (d) => d.__amount || 0),
      (d) => d.__category,
    );

    const categoriesInView = Array.from(totalsByCategory.keys()).sort(
      (a, b) =>
        (totalsByCategory.get(b) || 0) - (totalsByCategory.get(a) || 0) ||
        a.localeCompare(b),
    );

    clear(listEl);
    clear(extraEl);
    extraEl.style.display = "none";

    if (categoriesInView.length === 0) {
      listEl.appendChild(
        Object.assign(document.createElement("div"), {
          textContent: labels.noRecordsInView,
        }),
      );
      toggleBtn.style.display = "none";
    } else {
      const renderItem = (category) => {
        const row = document.createElement("div");
        row.style.cssText =
          "display:flex; align-items:center; gap:6px; margin:1px 0; font-family:'IBM Plex Sans', sans-serif;";

        const sw = document.createElement("span");
        sw.style.cssText = `
          display:inline-block; width:8px; height:8px; border-radius:50%;
          background:${getCategoryColor(category)}; border:1px solid rgba(0,0,0,0.25);
        `;

        const label = document.createElement("span");
        label.textContent = category;

        row.appendChild(sw);
        row.appendChild(label);

        return row;
      };

      const headCount = Math.min(
        window.matchMedia("(max-width: 640px)").matches ? 6 : 12,
        categoriesInView.length,
      );

      categoriesInView
        .slice(0, headCount)
        .forEach((category) => listEl.appendChild(renderItem(category)));

      const remaining = categoriesInView.slice(headCount);

      if (remaining.length > 0) {
        remaining.forEach((category) =>
          extraEl.appendChild(renderItem(category)),
        );
        toggleBtn._showText = `Show all (+${remaining.length})`;
        toggleBtn.textContent = toggleBtn._showText;
        toggleBtn.style.display = "inline-block";
      } else {
        toggleBtn.style.display = "none";
      }
    }

    clear(sizeRowEl);

    const amountsVis = recordsInViewArr
      .map((d) => d.__amount)
      .filter(Number.isFinite)
      .sort((a, b) => a - b);

    const steps = amountsVis.length
      ? [
          amountsVis[0],
          d3.quantile(amountsVis, 0.5) ?? amountsVis[0],
          amountsVis[amountsVis.length - 1],
        ]
      : [aMinAll || 0, ((aMinAll || 0) + (aMaxAll || 1)) / 2, aMaxAll || 1];

    steps.forEach((v) => {
      const r = Math.max(3, size(v) || 6);
      const rLegend = Math.max(2.4, r * 0.8);

      const item = document.createElement("div");
      item.style.cssText =
        "display:flex; align-items:center; gap:6px; font-family:'IBM Plex Sans', sans-serif;";

      const dot = document.createElement("span");
      dot.style.cssText = `
        display:inline-block; width:${2 * rLegend}px; height:${2 * rLegend}px;
        border-radius:50%; background:#bbb; border:1px solid rgba(0,0,0,0.25);
      `;

      const label = document.createElement("span");
      label.textContent = amountFormatter(v);

      item.appendChild(dot);
      item.appendChild(label);
      sizeRowEl.appendChild(item);
    });
  }

  const status = Object.assign(document.createElement("div"), {
    innerHTML: `<strong>${escapeHtml(labels.visibleCount)}:</strong> 0`,
  });

  status.style.cssText =
    "position:absolute;top:78px;left:8px;background:rgba(255,255,255,0.95);padding:6px 8px;border-radius:8px;font:12px 'IBM Plex Sans', sans-serif;box-shadow:0 1px 3px rgba(0,0,0,0.15)";
  container.appendChild(status);

  function updateStatus() {
    status.innerHTML = `<strong>${escapeHtml(labels.visibleCount)}:</strong> ${recordsInView().length}`;
  }

  function doUpdate() {
    const vis = recordsInView();
    renderLegendFor(vis);
    updateStatus();
  }

  let pending = null;

  function scheduleUpdate() {
    if (pending) return;
    pending = requestAnimationFrame(() => {
      pending = null;
      doUpdate();
    });
  }

  map.on("moveend", scheduleUpdate);
  map.on("zoomend", scheduleUpdate);

  // Geolocation
  const userLayer = L.layerGroup().addTo(map);

  function clearUserLocation() {
    userLayer.clearLayers();
  }

  function locateUser() {
    if (!navigator.geolocation) {
      status.innerHTML = `<strong>${escapeHtml(labels.visibleCount)}:</strong> ${recordsInView().length}<br>${escapeHtml(labels.locationUnavailable)}`;
      if (typeof onLocate === "function") {
        onLocate({ ok: false, reason: "unsupported" });
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearUserLocation();

        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const accuracy = position.coords.accuracy ?? 0;

        const latlng = L.latLng(lat, lon);

        const accuracyCircle = L.circle(latlng, {
          radius: accuracy,
          color: "#4a463d",
          weight: 1,
          opacity: 0.7,
          fillColor: "#4a463d",
          fillOpacity: 0.12,
        });

        const userMarker = L.circleMarker(latlng, {
          radius: 7,
          color: "#ffffff",
          weight: 2,
          fillColor: "#4a463d",
          fillOpacity: 1,
        }).bindTooltip("Your location", {
          direction: "top",
          offset: [0, -4],
          className: "topic-map-tooltip",
        });

        userLayer.addLayer(accuracyCircle);
        userLayer.addLayer(userMarker);

        const pt = turf.point([lon, lat]);
        const inside = polygons.some((poly) =>
          turf.booleanPointInPolygon(pt, poly),
        );

        map.flyTo(latlng, Math.max(map.getZoom(), 13), {
          animate: true,
          duration: 0.75,
        });

        status.innerHTML = `<strong>${escapeHtml(labels.visibleCount)}:</strong> ${recordsInView().length}<br>${escapeHtml(
          inside ? labels.locationInside : labels.locationOutside,
        )}`;

        if (typeof onLocate === "function") {
          onLocate({
            ok: true,
            lat,
            lon,
            accuracy,
            inside,
          });
        }
      },
      (error) => {
        const message =
          error?.code === 1
            ? "Location permission denied."
            : error?.code === 2
              ? "Position unavailable."
              : error?.code === 3
                ? "Location request timed out."
                : labels.locationUnavailable;

        status.innerHTML = `<strong>${escapeHtml(labels.visibleCount)}:</strong> ${recordsInView().length}<br>${escapeHtml(message)}`;

        if (typeof onLocate === "function") {
          onLocate({ ok: false, reason: "error", error });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  }

  if (enableGeolocation) {
    const GeolocateControl = L.Control.extend({
      options: { position: "bottomright" },
      onAdd: () => {
        const ctl = L.DomUtil.create(
          "div",
          "leaflet-control-geolocate leaflet-bar",
        );

        const button = L.DomUtil.create("button", "", ctl);
        button.type = "button";
        button.title = labels.locateTitle;
        button.setAttribute("aria-label", labels.locateTitle);
        button.textContent = "⌖";

        L.DomEvent.disableClickPropagation(ctl);
        L.DomEvent.disableScrollPropagation(ctl);

        L.DomEvent.on(button, "click", (e) => {
          L.DomEvent.stop(e);
          locateUser();
        });

        return ctl;
      },
    });

    new GeolocateControl().addTo(map);
  }

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
      link.style.fontFamily = '"IBM Plex Sans", sans-serif';

      const isFsAPI = () =>
        document.fullscreenElement === container ||
        document.webkitFullscreenElement === container;

      const enterFsAPI = async () => {
        if (container.requestFullscreen) await container.requestFullscreen();
        else if (container.webkitRequestFullscreen) {
          container.webkitRequestFullscreen();
        }
      };

      const exitFsAPI = async () => {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) {
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
            if (isFsAPI()) await exitFsAPI();
            else await enterFsAPI();
          } catch {
            if (fallbackActive) exitFallback();
            else enterFallback();
          }
        })();
      });

      ["fullscreenchange", "webkitfullscreenchange"].forEach((ev) => {
        document.addEventListener(ev, () =>
          setTimeout(() => map.invalidateSize(), 50),
        );
      });

      return ctl;
    },
  });

  new FullscreenControl().addTo(map);

  requestAnimationFrame(() => {
    map.invalidateSize();
    if (boundaryLayer.getBounds().isValid()) {
      map.fitBounds(boundaryLayer.getBounds(), {
        padding: [24, 24],
        maxZoom: 19,
      });
    }
    doUpdate();
  });

  return container;
}
