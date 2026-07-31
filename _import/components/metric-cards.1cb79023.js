export function metricCards({ metrics = [], title = null } = {}) {
  const container = document.createElement("section");
  container.className = "insights-summary";

  if (title) {
    const heading = document.createElement("h2");
    heading.textContent = title;
    container.appendChild(heading);
  }

  if (!Array.isArray(metrics) || metrics.length === 0) {
    return container;
  }

  const grid = document.createElement("div");
  grid.className = "metrics-grid";
  grid.dataset.count = String(metrics.length);

  for (const metric of metrics) {
    const card = document.createElement("article");
    card.className = "metric-card";
    if (metric.compactValue) card.classList.add("metric-card--compact-value");

    const label = document.createElement("p");
    label.className = "metric-card__label";
    label.textContent = metric.label ?? "";

    const value = document.createElement("p");
    value.className = "metric-card__value";
    value.textContent = metric.value ?? "—";

    card.appendChild(label);
    card.appendChild(value);

    if (metric.note) {
      const note = document.createElement("p");
      note.className = "metric-card__note";
      note.textContent = metric.note;
      card.appendChild(note);
    }

    grid.appendChild(card);
  }

  container.appendChild(grid);
  return container;
}
