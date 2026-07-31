export function relatedResearchResource({
  rows = [],
  emptyMessage = "No related research is currently listed for this topic.",
} = {}) {
  const resource = document.createElement("div");
  resource.className = "research-resource";

  if (Array.isArray(rows) && rows.length > 0) {
    const table = document.createElement("div");
    table.className = "research-resource__table";
    table.innerHTML = `
      <div class="research-resource__header" aria-hidden="true">
        <span>Date</span>
        <span>Research by</span>
        <span>Publication</span>
        <span></span>
      </div>
    `;

    for (const research of rows) {
      const row = document.createElement("article");
      row.className = "research-resource__row";
      const author = escapeHtml(research.author ?? "");
      const authorMarkup = research.authorUrl
        ? `<a href="${escapeHtml(research.authorUrl)}" target="_blank" rel="noreferrer">${author}</a>`
        : author;
      row.innerHTML = `
        <time class="research-resource__date" datetime="${escapeHtml(research.date)}">${escapeHtml(formatIrishDate(research.date))}</time>
        <div class="research-resource__author">${authorMarkup}</div>
        <div class="research-resource__title">${escapeHtml(research.title ?? "Research document")}</div>
        <div class="research-resource__action">
          <a class="research-resource__button" href="${escapeHtml(research.url)}" target="_blank" rel="noreferrer">View</a>
        </div>
      `;
      table.appendChild(row);
    }

    resource.appendChild(table);
  } else {
    const empty = document.createElement("p");
    empty.className = "chart-loading";
    empty.textContent = emptyMessage;
    resource.appendChild(empty);
  }

  return resource;
}

function formatIrishDate(isoDate) {
  if (!isoDate) return "";
  return new Intl.DateTimeFormat("en-IE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${isoDate}T00:00:00`));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
