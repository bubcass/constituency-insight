export function createReactiveMount(renderFn, {
  eventName,
  eventNames,
  debounceMs = 40,
  skeleton = "chart",
  skeletonHeight,
  skeletonDelay = 120,
  destroyPrevious = false,
  animate = true,
  defer = false,
  rootMargin = "300px",
} = {}) {
  const host = document.createElement("div");
  host.className = `reactive-view reactive-view--${skeleton}`;
  host.setAttribute("aria-live", "polite");

  const names = eventNames ?? (eventName ? [eventName] : []);
  let timeoutId = null;
  let runId = 0;
  let hasRendered = false;

  async function run() {
    const currentRun = ++runId;
    host.setAttribute("aria-busy", "true");

    if (!hasRendered) {
      host.replaceChildren(createSkeleton(skeleton, skeletonHeight));
      await delay(skeletonDelay);
      if (currentRun !== runId) return;
    } else {
      host.classList.add("is-updating");
    }

    const result = await renderFn();
    if (currentRun !== runId) return;

    if (destroyPrevious) host.firstElementChild?.destroy?.();
    host.replaceChildren(result ?? document.createTextNode(""));
    host.classList.remove("is-updating");
    host.setAttribute("aria-busy", "false");

    if (
      hasRendered &&
      animate &&
      result instanceof Element &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      result.animate(
        [{opacity: 0.74}, {opacity: 1}],
        {duration: 180, easing: "ease-out"},
      );
    }

    hasRendered = true;
  }

  function scheduleRun() {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(run, debounceMs);
  }

  // Expensive charts and tables do not need to compete with the page's first
  // paint.  Keep their layout stable with the existing skeleton, then build
  // them shortly before they enter the viewport.  This mirrors the deferred
  // mounts used by PQ Explorer while retaining the same reactive API.
  if (defer && "IntersectionObserver" in window) {
    host.replaceChildren(createSkeleton(skeleton, skeletonHeight));
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      run();
    }, {rootMargin});
    observer.observe(host);
  } else {
    run();
  }
  for (const name of names) window.addEventListener(name, scheduleRun);
  return host;
}

function createSkeleton(type, height) {
  const skeleton = document.createElement("div");
  const safeHeight = Number.isFinite(height) ? Math.max(80, height) : null;
  skeleton.className = `reactive-skeleton reactive-skeleton--${type}`;
  if (safeHeight) skeleton.style.minHeight = `${safeHeight}px`;

  const status = document.createElement("span");
  status.className = "reactive-skeleton__status";
  status.textContent = "Loading content…";
  skeleton.appendChild(status);

  if (type === "map") {
    skeleton.classList.add("map-skeleton", "skeleton-shimmer");
    return skeleton;
  }

  if (type === "cards") {
    skeleton.innerHTML += `
      <div class="cards-skeleton" aria-hidden="true">
        ${Array.from({length: 4}, () => `
          <div class="cards-skeleton__card">
            <span class="cards-skeleton__line cards-skeleton__line--short skeleton-shimmer"></span>
            <span class="cards-skeleton__line cards-skeleton__line--value skeleton-shimmer"></span>
            <span class="cards-skeleton__line skeleton-shimmer"></span>
          </div>
        `).join("")}
      </div>
    `;
    return skeleton;
  }

  if (type === "table") {
    skeleton.innerHTML += `
      <div class="table-skeleton" aria-hidden="true">
        ${Array.from({length: 5}, () => `
          <div class="table-skeleton__row">
            <span class="table-skeleton__cell skeleton-shimmer"></span>
            <span class="table-skeleton__cell skeleton-shimmer"></span>
            <span class="table-skeleton__cell skeleton-shimmer"></span>
          </div>
        `).join("")}
      </div>
    `;
    return skeleton;
  }

  if (type === "text" || type === "control") {
    skeleton.innerHTML += `
      <div class="text-skeleton" aria-hidden="true">
        <span class="text-skeleton__line text-skeleton__line--lg text-skeleton__line--w84 skeleton-shimmer"></span>
        <span class="text-skeleton__line text-skeleton__line--w100 skeleton-shimmer"></span>
        <span class="text-skeleton__line text-skeleton__line--w72 skeleton-shimmer"></span>
      </div>
    `;
    return skeleton;
  }

  skeleton.classList.add("chart-skeleton", "chart-skeleton--bars");
  skeleton.innerHTML += `
    <div class="chart-skeleton__bars" aria-hidden="true">
      ${Array.from({length: 7}, () => `<span class="chart-skeleton__bar skeleton-shimmer"></span>`).join("")}
    </div>
  `;
  return skeleton;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
