const tabs = [
  { id: "people", label: "People", href: "./people" },
  { id: "education", label: "Education", href: "./education" },
  { id: "employment", label: "Work", href: "./employment" },
  { id: "housing", label: "Housing", href: "./housing" },
  { id: "transport", label: "Transport", href: "./transport" },
  { id: "spotlights", label: "Spotlights", href: "./spotlight" },
];

let tabsInstance = 0;

export function insightsTabs(activeTab, {basePath = "."} = {}) {
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const listId = `insights-topics-${++tabsInstance}`;
  const shell = document.createElement("div");
  shell.className = "insights-tabs-shell";

  const nav = document.createElement("nav");
  nav.className = "insights-tabs";
  nav.setAttribute("aria-label", "Constituency insight topics");

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "insights-tabs__toggle";
  toggle.setAttribute("aria-controls", listId);
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", `Current topic: ${active.label}. Open topic navigation`);
  toggle.innerHTML = `
    <span>${active.label}</span>
    <i aria-hidden="true"></i>
  `;

  const list = document.createElement("div");
  list.className = "insights-tabs__list";
  list.id = listId;

  for (const tab of tabs) {
    const link = document.createElement("a");
    link.className = "insights-tabs__link";
    link.href = `${basePath.replace(/\/$/, "")}/${tab.href.replace(/^\.\//, "")}`;
    link.textContent = tab.label;

    if (tab.id === activeTab) {
      link.classList.add("is-active");
      link.setAttribute("aria-current", "page");
    }

    list.appendChild(link);
  }

  nav.append(toggle, list);
  shell.appendChild(nav);

  if (typeof window !== "undefined") {
    let frame = null;
    let menuOpen = false;
    const mobileQuery = window.matchMedia("(max-width: 720px)");
    const mastheadQuery = window.matchMedia("(min-width: 901px)");

    const setMenuOpen = (open, {focusToggle = false} = {}) => {
      menuOpen = mobileQuery.matches && open;
      nav.classList.toggle("is-open", menuOpen);
      toggle.setAttribute("aria-expanded", String(menuOpen));
      list.hidden = mobileQuery.matches && !menuOpen;
      if (focusToggle) toggle.focus();
    };

    const syncNavigationMode = () => {
      toggle.hidden = !mobileQuery.matches;
      setMenuOpen(false);
    };

    const syncFloating = () => {
      frame = null;
      const masthead = document.querySelector(".oireachtas-masthead");
      const mastheadInner = masthead?.querySelector(".oireachtas-masthead__inner");
      const mastheadActions = mastheadInner?.querySelector(".oireachtas-masthead__actions");
      const mobileTools = document.querySelector(".mobile-reading-tools");
      const mobileMore = mobileTools?.querySelector(".mobile-reading-tools__more-wrap");
      const mastheadHeight = masthead?.offsetHeight || 0;
      const navHeight = nav.offsetHeight;
      const dockingLine = mobileQuery.matches ? 12 : mastheadHeight;
      const shouldFloat = shell.getBoundingClientRect().top <= dockingLine;
      const shouldDockInMasthead = shouldFloat && mastheadQuery.matches && mastheadInner;
      const shouldDockInMobileTools = shouldFloat && mobileQuery.matches && mobileTools;

      shell.style.height = shouldFloat ? `${navHeight}px` : "";
      shell.classList.toggle("insights-tabs-shell--floating", shouldFloat);
      nav.classList.toggle("insights-tabs--floating", shouldFloat);
      nav.classList.toggle("insights-tabs--masthead", Boolean(shouldDockInMasthead));
      nav.classList.toggle("insights-tabs--mobile-tools", Boolean(shouldDockInMobileTools));
      document.documentElement.classList.toggle("has-floating-insights-tabs", shouldFloat);

      if (shouldDockInMobileTools && nav.parentNode !== mobileTools) {
        mobileTools.insertBefore(nav, mobileMore || null);
      } else if (shouldDockInMasthead && nav.parentNode !== mastheadInner) {
        mastheadInner.insertBefore(nav, mastheadActions || null);
      } else if (!shouldDockInMobileTools && !shouldDockInMasthead && nav.parentNode !== shell) {
        shell.appendChild(nav);
      }
    };

    const scheduleSync = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(syncFloating);
    };

    toggle.addEventListener("click", () => setMenuOpen(!menuOpen));
    document.addEventListener("pointerdown", (event) => {
      if (menuOpen && !nav.contains(event.target)) setMenuOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menuOpen) setMenuOpen(false, {focusToggle: true});
    });
    list.addEventListener("click", (event) => {
      if (event.target.closest("a")) setMenuOpen(false);
    });
    mobileQuery.addEventListener("change", syncNavigationMode);
    mastheadQuery.addEventListener("change", scheduleSync);

    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);
    syncNavigationMode();
    window.requestAnimationFrame(syncFloating);
  }

  return shell;
}
