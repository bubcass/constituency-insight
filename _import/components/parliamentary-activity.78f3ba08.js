export function parliamentaryQuestionList({
  rows = [],
  members = [],
  partyColorMap = new Map(),
  emptyMessage = "No recent parliamentary questions available for this constituency.",
} = {}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return emptyState(emptyMessage);
  }

  const memberLookup = new Map(
    members.map((member) => [normaliseName(member.memberName), member]),
  );
  const wrap = document.createElement("div");
  wrap.className = "debates-list debates-list--pqs";

  for (const question of rows) {
    const member = memberLookup.get(normaliseName(question.deputy));
    const party = member?.party ?? "Independent";
    const ringColor = partyColorMap.get(party) ?? "#666666";
    const imageUrl = member?.memberCode
      ? `https://data.oireachtas.ie/ie/oireachtas/member/id/${member.memberCode}/image/large`
      : null;
    const row = document.createElement("article");
    row.className = "debates-list__row debates-list__row--pqs";

    row.innerHTML = `
      <div class="debates-list__date">${escapeHtml(formatIrishDate(question.date))}</div>
      <div class="debates-list__topic debates-list__topic--with-avatar">
        ${memberAvatar(question.deputy, imageUrl, ringColor)}
        <div class="debates-list__topic-main">
          <div class="debates-list__topic-title">${escapeHtml(question.heading ?? "Parliamentary question")}</div>
          <div class="debates-list__topic-meta">${escapeHtml(question.deputy ?? "")}</div>
        </div>
      </div>
      <div class="debates-list__action">
        <a class="debates-list__button" href="${escapeHtml(question.url)}" target="_blank" rel="noreferrer">View</a>
      </div>
    `;

    wrap.appendChild(row);
  }

  return wrap;
}

export function memberContributionLinks({
  members = [],
  partyColorMap = new Map(),
  emptyMessage = "No member contribution links available for this constituency.",
} = {}) {
  if (!Array.isArray(members) || members.length === 0) {
    return emptyState(emptyMessage);
  }

  const wrap = document.createElement("div");
  wrap.className = "debates-list debates-list--pqs";

  for (const member of members) {
    const displayName = member.memberName ?? "Unknown member";
    const party = member.party ?? "Independent";
    const ringColor = partyColorMap.get(party) ?? "#666666";
    const imageUrl = member.memberCode
      ? `https://data.oireachtas.ie/ie/oireachtas/member/id/${member.memberCode}/image/large`
      : null;
    const row = document.createElement("article");
    row.className = "debates-list__row debates-list__row--pqs";

    row.innerHTML = `
      <div class="debates-list__date">${escapeHtml(party)}</div>
      <div class="debates-list__topic debates-list__topic--with-avatar">
        ${memberAvatar(displayName, imageUrl, ringColor)}
        <div class="debates-list__topic-main">
          <div class="debates-list__topic-title">Recent contributions from ${escapeHtml(displayName)}</div>
          <div class="debates-list__topic-meta">Dáil and committee debates</div>
        </div>
      </div>
      <div class="debates-list__action">
        <a class="debates-list__button" href="${escapeHtml(member.memberUrl)}" target="_blank" rel="noreferrer">Explore</a>
      </div>
    `;

    wrap.appendChild(row);
  }

  return wrap;
}

export function memberContributionList({
  rows = [],
  members = [],
  partyColorMap = new Map(),
  emptyMessage = "No recent Dáil contributions available for this constituency.",
} = {}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return emptyState(emptyMessage);
  }

  const memberLookup = new Map(
    members.map((member) => [member.memberCode, member]),
  );
  const wrap = document.createElement("div");
  wrap.className = "debates-list debates-list--contributions";

  for (const contribution of rows) {
    const member = memberLookup.get(contribution.memberCode);
    const displayName = member?.memberName ?? contribution.memberName ?? "Unknown member";
    const party = member?.party ?? "Independent";
    const ringColor = partyColorMap.get(party) ?? "#666666";
    const imageUrl = contribution.memberCode
      ? `https://data.oireachtas.ie/ie/oireachtas/member/id/${contribution.memberCode}/image/large`
      : null;
    const speechLabel = `${contribution.speechCount ?? 0} ${
      contribution.speechCount === 1 ? "speech" : "speeches"
    }`;
    const context = [displayName, contribution.parentTopic, speechLabel]
      .filter(Boolean)
      .join(" · ");
    const row = document.createElement("article");
    row.className = "debates-list__row debates-list__row--contribution";

    row.innerHTML = `
      <div class="debates-list__date">${escapeHtml(formatIrishDate(contribution.date))}</div>
      <div class="debates-list__topic debates-list__topic--with-avatar">
        ${memberAvatar(displayName, imageUrl, ringColor)}
        <div class="debates-list__topic-main">
          <div class="debates-list__topic-title">${escapeHtml(contribution.topic ?? "Dáil debate")}</div>
          <div class="debates-list__topic-meta">${escapeHtml(context)}</div>
        </div>
      </div>
      <div class="debates-list__action">
        <a class="debates-list__button" href="${escapeHtml(contribution.url)}" target="_blank" rel="noreferrer">View</a>
      </div>
    `;

    wrap.appendChild(row);
  }

  return wrap;
}

function memberAvatar(name, imageUrl, ringColor) {
  const safeName = escapeHtml(name ?? "Member");
  const safeColor = escapeHtml(ringColor);

  if (imageUrl) {
    return `
      <div class="debates-list__avatar" style="--avatar-ring:${safeColor}">
        <img src="${escapeHtml(imageUrl)}" alt="${safeName}" loading="lazy" />
      </div>
    `;
  }

  return `
    <div class="debates-list__avatar debates-list__avatar--placeholder" style="--avatar-ring:${safeColor}">
      <span>${escapeHtml(initials(name))}</span>
    </div>
  `;
}

function emptyState(message) {
  const p = document.createElement("p");
  p.className = "chart-loading";
  p.textContent = message;
  return p;
}

function normaliseName(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function initials(value) {
  return String(value ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
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
    .replaceAll('"', "&quot;");
}
