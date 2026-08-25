import L from "npm:leaflet@1.9.4";

const BLANK_TILE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

export function addStandardBaseLayer(map) {
  map.attributionControl.setPrefix(
    '<a href="https://leafletjs.com" target="_blank" rel="noreferrer">Leaflet</a>',
  );

  return L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    detectRetina: true,
    errorTileUrl: BLANK_TILE,
  }).addTo(map);
}

export function addStandardMapControls(
  map,
  container,
  {
    position = "bottomright",
    scrollWheelZoom = true,
    fullscreen = true,
  } = {},
) {
  if (scrollWheelZoom) map.scrollWheelZoom.enable();
  else map.scrollWheelZoom.disable();

  let fallbackFullscreen = false;
  let fullscreenButton = null;
  const controls = [];

  const ToolsControl = L.Control.extend({
    options: { position },
    onAdd: () => {
      const control = L.DomUtil.create(
        "div",
        "leaflet-control-map-tools leaflet-bar",
      );

      if (fullscreen) {
        fullscreenButton = L.DomUtil.create("button", "", control);
        fullscreenButton.type = "button";
        fullscreenButton.innerHTML = '<span aria-hidden="true">⛶</span>';
        fullscreenButton.title = "View map fullscreen";
        fullscreenButton.setAttribute("aria-label", "View map fullscreen");
        fullscreenButton.setAttribute("aria-pressed", "false");

        L.DomEvent.on(fullscreenButton, "click", (event) => {
          L.DomEvent.stop(event);
          toggleFullscreen();
        });
      }

      L.DomEvent.disableClickPropagation(control);
      L.DomEvent.disableScrollPropagation(control);
      return control;
    },
  });

  function isNativeFullscreen() {
    return (
      document.fullscreenElement === container ||
      document.webkitFullscreenElement === container
    );
  }

  function updateFullscreenButton() {
    if (!fullscreenButton) return;
    const active = isNativeFullscreen() || fallbackFullscreen;
    fullscreenButton.classList.toggle("is-active", active);
    fullscreenButton.setAttribute("aria-pressed", String(active));
    fullscreenButton.setAttribute(
      "aria-label",
      active ? "Exit map fullscreen" : "View map fullscreen",
    );
    fullscreenButton.title = active
      ? "Exit map fullscreen"
      : "View map fullscreen";
    setTimeout(() => map.invalidateSize(), 50);
  }

  function enterFallbackFullscreen() {
    fallbackFullscreen = true;
    container.classList.add("is-map-fullscreen");
    document.body.classList.add("has-map-fullscreen");
    updateFullscreenButton();
  }

  function exitFallbackFullscreen() {
    fallbackFullscreen = false;
    container.classList.remove("is-map-fullscreen");
    document.body.classList.remove("has-map-fullscreen");
    updateFullscreenButton();
  }

  async function toggleFullscreen() {
    try {
      if (isNativeFullscreen()) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } else if (fallbackFullscreen) {
        exitFallbackFullscreen();
      } else if (container.requestFullscreen) {
        await container.requestFullscreen();
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else {
        enterFallbackFullscreen();
      }
    } catch {
      if (fallbackFullscreen) exitFallbackFullscreen();
      else enterFallbackFullscreen();
    }
  }

  const onFullscreenChange = () => updateFullscreenButton();
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);

  const toolsControl = new ToolsControl().addTo(map);
  controls.push(toolsControl);

  return {
    destroy() {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      if (fallbackFullscreen) exitFallbackFullscreen();
      controls.forEach((control) => control.remove());
    },
  };
}
