import {resolveConstituencyUrlState, updateConstituencyUrl} from "./constituency-url-state.3607cf90.js";

export function constituencySelect({
  state = {
    constituency: null,
  },
  resultsPromise = Promise.resolve([]),
  onChange = () => {},
  onLocate = null,
} = {}) {
  const container = document.createElement("div");
  container.className = "pq-controls pq-controls--single";

  function uniqueSorted(values) {
    return Array.from(new Set(values)).sort((a, b) =>
      String(a).localeCompare(String(b), "en", { sensitivity: "base" }),
    );
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function render(options = []) {
    if (!state.constituency && options.length) {
      state.constituency = options[0];
    }

    container.innerHTML = `
      <div class="control control--constituency">
        <div class="constituency-control-heading">
          <label for="constituency-select" class="control-label">Select a constituency</label>
          ${typeof onLocate === "function" ? `
            <button type="button" class="constituency-location-action">Use my location</button>
          ` : ""}
        </div>
        <select id="constituency-select" name="Select a constituency" class="control-input">
          ${options
            .map(
              (value) => `
                <option value="${escapeHtml(value)}" ${
                  state.constituency === value ? "selected" : ""
                }>
                  ${escapeHtml(value)}
                </option>
              `,
            )
            .join("")}
        </select>
        ${typeof onLocate === "function" ? `
          <span class="constituency-location-status" aria-live="polite"></span>
        ` : ""}
      </div>
    `;

    const select = container.querySelector("select");
    const locateButton = container.querySelector(".constituency-location-action");
    const locateStatus = container.querySelector(".constituency-location-status");

    updateConstituencyUrl(state.constituency);

    const applyUrlSelection = () => {
      const constituency = resolveConstituencyUrlState({
        constituencies: options,
        search: window.location.search,
      });
      if (!constituency || constituency === state.constituency) return;
      state.constituency = constituency;
      onChange(state);
    };

    const handlers = window.__constituencyUrlHandlers ??= new Map();
    handlers.set(window.location.pathname, applyUrlSelection);
    if (!window.__constituencyUrlPopstateListener) {
      window.__constituencyUrlPopstateListener = true;
      window.addEventListener("popstate", () => {
        window.__constituencyUrlHandlers
          .get(window.location.pathname)
          ?.();
      });
    }

    select?.addEventListener("change", () => {
      state.constituency = select.value;
      if (locateStatus) locateStatus.textContent = "";
      updateConstituencyUrl(state.constituency, {mode: "push"});
      onChange(state);
    });

    locateButton?.addEventListener("click", async () => {
      locateButton.disabled = true;
      locateButton.textContent = "Finding constituency…";
      locateStatus.textContent = "";

      try {
        const result = await onLocate({ options });

        if (result?.ok && options.includes(result.constituency)) {
          state.constituency = result.constituency;
          select.value = result.constituency;
          locateStatus.textContent = `Showing ${result.constituency}`;
          updateConstituencyUrl(state.constituency, {mode: "push"});
          onChange(state);
        } else {
          locateStatus.textContent = "Location unavailable — choose from the list.";
        }
      } catch {
        locateStatus.textContent = "Location unavailable — choose from the list.";
      } finally {
        locateButton.disabled = false;
        locateButton.textContent = "Use my location";
      }
    });
  }

  Promise.resolve(resultsPromise)
    .then((rows) => {
      const options = uniqueSorted(
        (Array.isArray(rows) ? rows : [])
          .map((d) => d.constituency)
          .filter(Boolean),
      );

      render(options);
    })
    .catch(() => {
      render([]);
    });

  return container;
}
