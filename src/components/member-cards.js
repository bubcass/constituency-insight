export function memberCards({
  members = [],
  partyColorMap = new Map(),
  title = null,
  constituency = null,
  emptyMessage = "No member information available.",
} = {}) {
  const container = document.createElement("section");
  container.className = "insights-members";

  if (title) {
    const heading = document.createElement("h2");
    heading.textContent = title;
    container.appendChild(heading);
  }

  if (!Array.isArray(members) || members.length === 0) {
    const empty = document.createElement("p");
    empty.className = "chart-loading";
    empty.textContent = emptyMessage;
    container.appendChild(empty);
    return container;
  }

  const cardsGrid = document.createElement("div");
  cardsGrid.className = "elected-strip";
  cardsGrid.dataset.count = String(members.length);

  for (const member of members) {
    const party = member.matchedParty || member.party || "Independent";
    const color = partyColorMap.get(party) ?? "#666666";

    const wrapper = document.createElement(member.memberUrl ? "a" : "div");
    wrapper.className = member.memberUrl
      ? "elected-strip__card-link"
      : "elected-strip__card-link elected-strip__card-link--static";

    if (member.memberUrl) {
      wrapper.href = member.memberUrl;
      wrapper.target = "_blank";
      wrapper.rel = "noreferrer";
    }

    const displayName =
      member.displayName || member.memberName || "Unknown member";

    const imageMarkup = member.imageUrl
      ? `
        <img
          class="elected-strip__image"
          src="${member.imageUrl}"
          alt="${escapeHtml(displayName)}"
        />
      `
      : `
        <div class="elected-strip__placeholder">
          ${escapeHtml(displayName.slice(0, 1))}
        </div>
      `;

    wrapper.innerHTML = `
      <article class="elected-strip__card">
        <div class="elected-strip__media" style="--party-color:${escapeHtml(color)}">
          <div class="elected-strip__ring">
            ${imageMarkup}
          </div>
        </div>
        <div class="elected-strip__name">${escapeHtml(displayName)}</div>
        <div class="elected-strip__party">${escapeHtml(party)}</div>
      </article>
    `;

    cardsGrid.appendChild(wrapper);
  }

  container.appendChild(cardsGrid);

  const selectedConstituency = String(
    constituency ?? members.find((member) => member?.constituency)?.constituency ?? ""
  ).trim();

  if (selectedConstituency) {
    const electionCta = document.createElement("p");
    electionCta.className = "insights-members__election-link";

    const link = document.createElement("a");
    link.className = "link-arrow";
    link.href = electionExplorerUrl(selectedConstituency);
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = selectedConstituency;

    electionCta.append("Explore how the TDs were elected in ");
    electionCta.appendChild(link);
    container.appendChild(electionCta);
  }

  return container;
}

export function electionExplorerUrl(constituency) {
  const url = new URL("https://bubcass.github.io/election-explorer/");
  url.searchParams.set("constituency", constituencySlug(constituency));
  url.searchParams.set("election", "2024-general-election");
  return url.href;
}

function constituencySlug(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
