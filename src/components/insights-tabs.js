const tabs = [
  { id: "people", label: "People", href: "./people" },
  { id: "education", label: "Education", href: "./education" },
  { id: "employment", label: "Work", href: "./employment" },
  { id: "housing", label: "Housing", href: "./housing" },
  { id: "transport", label: "Transport", href: "./transport" },
  { id: "spotlights", label: "Spotlights", href: "./spotlights" },
];

let tabsInstance = 0;

export function insightsTabs(activeTab) {
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
    link.href = tab.href;
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
      const shouldFloat = shell.getBoundingClientRect().top <= 0;
      shell.classList.toggle("insights-tabs-shell--floating", shouldFloat);
      shell.style.height = shouldFloat ? `${nav.offsetHeight}px` : "";
    };

    const scheduleSync = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(syncFloating);
    };

    toggle.addEventListener("click", () => setMenuOpen(!menuOpen));
    document.addEventListener("pointerdown", (event) => {
      if (menuOpen && !shell.contains(event.target)) setMenuOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menuOpen) setMenuOpen(false, {focusToggle: true});
    });
    list.addEventListener("click", (event) => {
      if (event.target.closest("a")) setMenuOpen(false);
    });
    mobileQuery.addEventListener("change", syncNavigationMode);

    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);
    syncNavigationMode();
    window.requestAnimationFrame(syncFloating);
  }

  return shell;
}
