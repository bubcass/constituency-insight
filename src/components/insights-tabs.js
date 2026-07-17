const tabs = [
  { id: "people", label: "People", href: "./" },
  { id: "education", label: "Education", href: "./education" },
  { id: "employment", label: "Work", href: "./employment" },
  { id: "housing", label: "Housing", href: "./housing" },
  { id: "transport", label: "Transport", href: "./transport" },
  { id: "spotlights", label: "Spotlights", href: "./spotlights" },
];

export function insightsTabs(activeTab) {
  const shell = document.createElement("div");
  shell.className = "insights-tabs-shell";

  const nav = document.createElement("nav");
  nav.className = "insights-tabs";
  nav.setAttribute("aria-label", "Constituency insight topics");

  const list = document.createElement("div");
  list.className = "insights-tabs__list";

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

  nav.appendChild(list);
  shell.appendChild(nav);

  if (typeof window !== "undefined") {
    let frame = null;

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

    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);
    window.requestAnimationFrame(syncFloating);
  }

  return shell;
}
