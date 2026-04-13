---
title: "Constituency Insights"
header: false
sidebar: false
footer: false
toc: false
---

```js
import * as d3 from "npm:d3";
import * as turf from "npm:@turf/turf";
import { constituencySelect } from "./components/constituency-select.js";
import { metricCards } from "./components/metric-cards.js";
import { memberCards } from "./components/member-cards.js";
import { topicPointMap } from "./components/topic-point-map.js";
import { waterfallSegmentsChart } from "./components/waterfall-segments-chart.js";
import { downloadButton } from "./components/download-button.js";

import { sportsFundingTopic } from "./topics/sports-funding/config.js";
import {
  filterRowsByConstituency,
  buildMetricCardData
} from "./topics/sports-funding/transforms.js";

const sportsFundingPromise = FileAttachment(
  "data/derived/sports-funding-enriched.json"
).json();

const waterfallPromise = FileAttachment(
  "data/derived/waterfall-segments.json"
).json();

const pqSportsByConstituencyPromise = FileAttachment(
  "data/derived/pq-sports-related-by-constituency.json"
).json();

const sportsDebatesPromise = FileAttachment(
  "data/derived/debates-sections-sports.json"
).json();

const constituenciesGeoPromise = FileAttachment(
  "data/geo/constituencies.json"
).json();

const heroVideoPromise = FileAttachment("media/sports-funding-hero.mp4").url();

const membersLookupPromise = FileAttachment(
  "data/members-lookup.json"
).json();

const partyColorMap = new Map([
  ["Fianna Fáil", "#40b34e"],
  ["Sinn Féin", "#088460"],
  ["Fine Gael", "#303591"],
  ["Independent", "#666666"],
  ["Labour Party", "#c82832"],
  ["Social Democrats", "#782b81"],
  ["Independent Ireland", "#17becf"],
  ["People Before Profit-Solidarity", "#c5568b"],
  ["Aontú", "#ff7f0e"],
  ["100% RDR", "#985564"],
  ["Green Party", "#b4d143"]
]);

if (typeof window !== "undefined" && !window.insightsState) {
  window.insightsState = { constituency: null };
}

if (typeof window !== "undefined" && !window.waterfallState) {
  window.waterfallState = { year: "All" };
}

function getState() {
  return typeof window !== "undefined"
    ? window.insightsState
    : { constituency: null };
}

function getWaterfallState() {
  return typeof window !== "undefined"
    ? window.waterfallState
    : { year: "All" };
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanConstituencyName(name) {
  return clean(name).replace(/\s*\(\d+\)\s*$/, "");
}

function resolveLabel(label, context = {}) {
  return typeof label === "function" ? label(context) : label;
}

function getMemberImageUrl(memberCode) {
  const code = clean(memberCode);
  return code
    ? `https://data.oireachtas.ie/ie/oireachtas/member/id/${code}/image/large`
    : null;
}

function pointInFeature(feature, lon, lat) {
  try {
    const pt = turf.point([lon, lat]);
    return turf.booleanPointInPolygon(pt, feature);
  } catch {
    return false;
  }
}

async function getFundingRows() {
  return await sportsFundingPromise;
}

async function getWaterfallData() {
  return await waterfallPromise;
}

async function getPqSportsByConstituency() {
  return await pqSportsByConstituencyPromise;
}

async function getSportsDebates() {
  const rows = await sportsDebatesPromise;
  return Array.isArray(rows) ? rows : [];
}

async function getConstituenciesGeo() {
  return await constituenciesGeoPromise;
}

async function getMembersLookup() {
  return await membersLookupPromise;
}

async function getMembersArray() {
  const lookup = await getMembersLookup();
  return Object.values(lookup ?? {});
}

async function getAvailableConstituencies() {
  const rows = await getFundingRows();
  return Array.from(
    new Set(rows.map((d) => d.__constituency).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "en"));
}

async function detectUserConstituencyFromLocation() {
  if (typeof window === "undefined" || !navigator.geolocation) return null;

  const geo = await getConstituenciesGeo();
  const features = geo?.features ?? [];
  if (!features.length) return null;

  const position = await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000
      }
    );
  });

  if (!position) return null;

  const lat = position.coords.latitude;
  const lon = position.coords.longitude;

  const matched = features.find((feature) =>
    pointInFeature(feature, lon, lat)
  );

  if (!matched) return null;

  return cleanConstituencyName(matched?.properties?.ENG_NAME_VALUE);
}

async function initialiseConstituencySelection() {
  const options = await getAvailableConstituencies();

  if (!options.length) {
    window.insightsState.constituency = null;
    return;
  }

  const detected = await detectUserConstituencyFromLocation();

  if (detected && options.includes(detected)) {
    window.insightsState.constituency = detected;
    return;
  }

  if (
    !window.insightsState.constituency ||
    !options.includes(window.insightsState.constituency)
  ) {
    window.insightsState.constituency = options[0];
  }
}

async function ensureValidConstituency() {
  const options = await getAvailableConstituencies();

  if (!options.length) {
    window.insightsState.constituency = null;
    return null;
  }

  if (
    !window.insightsState.constituency ||
    !options.includes(window.insightsState.constituency)
  ) {
    window.insightsState.constituency = options[0];
  }

  return window.insightsState.constituency;
}

async function getSelectedRows() {
  const rows = await getFundingRows();
  const constituency = await ensureValidConstituency();
  return filterRowsByConstituency(rows, constituency);
}

async function getFilteredConstituencyGeo() {
  const selected = await ensureValidConstituency();
  const constituenciesGeo = await getConstituenciesGeo();

  return {
    type: "FeatureCollection",
    features: constituenciesGeo.features.filter(
      (feature) =>
        cleanConstituencyName(feature?.properties?.ENG_NAME_VALUE) === selected
    )
  };
}

async function getMatchedMembers() {
  const selected = await ensureValidConstituency();
  const members = await getMembersArray();

  return members
    .filter((d) => clean(d.constituency) === clean(selected))
    .map((member) => ({
      ...member,
      displayName: member.memberName ?? member.name ?? "Unknown member",
      memberUrl: member.memberUrl ?? null,
      matchedParty: member.party ?? "Independent",
      imageUrl: member.memberCode
        ? `https://data.oireachtas.ie/ie/oireachtas/member/id/${member.memberCode}/image/large`
        : null
    }));
}

async function getRecentSportsPQsForConstituency(limit = 10) {
  const [grouped, constituency, members] = await Promise.all([
    getPqSportsByConstituency(),
    ensureValidConstituency(),
    getMembersArray()
  ]);

  const rows = Array.isArray(grouped?.[constituency])
    ? grouped[constituency]
    : [];

  const memberLookup = new Map(
    members.map((m) => [clean(m.memberName ?? m.name).toLowerCase(), m])
  );

  return rows
    .map((row) => {
      const matched = memberLookup.get(clean(row.deputy).toLowerCase()) ?? null;
      const party = matched?.party ?? "Independent";

      return {
        ...row,
        matchedParty: party,
        memberCode: matched?.memberCode ?? null,
        imageUrl: getMemberImageUrl(matched?.memberCode),
        initials: clean(row.deputy)
          .split(/\s+/)
          .slice(0, 2)
          .map((d) => d[0] ?? "")
          .join("")
          .toUpperCase()
      };
    })
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))
    .slice(0, limit);
}

function getWaterfallColorLookup(rows = []) {
  const lookup = new Map();

  for (const row of rows) {
    for (const segment of row.segments ?? []) {
      if (segment?.Segment && segment?.color && !lookup.has(segment.Segment)) {
        lookup.set(segment.Segment, segment.color);
      }
    }
  }

  return lookup;
}

async function getRecentSportsDebates(limit = 5) {
  const rows = await getSportsDebates();

  return rows
    .filter((d) => d?.date && d?.topic && d?.webpage)
    .sort((a, b) => d3.descending(a.date, b.date))
    .slice(0, limit);
}

function formatIrishDate(isoDate) {
  if (!isoDate) return "";
  return new Intl.DateTimeFormat("en-IE", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(`${isoDate}T00:00:00`));
}

function rerender() {
  window.dispatchEvent(new CustomEvent("insights:change"));
  window.dispatchEvent(new CustomEvent("waterfall:change"));
}

function rerenderWaterfall() {
  window.dispatchEvent(new CustomEvent("waterfall:change"));
}

function mountReactive(renderFn, { eventName = "insights:change", debounceMs = 40 } = {}) {
  const el = document.createElement("div");
  let timeoutId = null;
  let runId = 0;

  async function run() {
    const currentRun = ++runId;
    const result = await renderFn();
    if (currentRun !== runId) return;
    el.replaceChildren(result);
  }

  function onChange() {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(run, debounceMs);
  }

  run();
  window.addEventListener(eventName, onChange);

  return el;
}

function euro(value) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(value ?? 0);
}

function chartPlaceholder(height = 320, text = "Updating…") {
  const wrap = document.createElement("div");
  wrap.className = "chart-loading";
  wrap.style.minHeight = `${height}px`;
  wrap.style.display = "grid";
  wrap.style.alignItems = "center";
  wrap.style.justifyItems = "center";
  wrap.style.border = "1px solid var(--border)";
  wrap.style.background = "rgba(255,255,255,0.55)";
  wrap.style.padding = "1rem";
  wrap.textContent = text;
  return wrap;
}

function renderSegmentedControl({
  label = "",
  name = "",
  options = [],
  value = "",
  onChange = () => {}
} = {}) {
  const wrap = document.createElement("div");
  wrap.className = "segmented-control-wrap";

  const group = document.createElement("div");
  group.className = "segmented-control";
  group.setAttribute("role", "radiogroup");
  if (label) group.setAttribute("aria-label", label);

  for (const option of options) {
    const controlId = `${name}-${String(option.value)
      .replace(/\s+/g, "-")
      .toLowerCase()}`;

    const labelEl = document.createElement("label");
    labelEl.className = "segmented-control__option";
    labelEl.setAttribute("for", controlId);

    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.id = controlId;
    input.value = option.value;
    input.checked = option.value === value;

    input.addEventListener("change", () => {
      if (input.checked) onChange(option.value);
    });

    const text = document.createElement("span");
    text.textContent = option.label;

    labelEl.appendChild(input);
    labelEl.appendChild(text);
    group.appendChild(labelEl);
  }

  wrap.appendChild(group);
  return wrap;
}

async function getAvailableWaterfallYears() {
  const rows = await getWaterfallData();
  return Array.from(new Set(rows.map((d) => String(d.period)).filter(Boolean)))
    .sort((a, b) => d3.ascending(a, b));
}

async function ensureValidWaterfallYear() {
  const years = await getAvailableWaterfallYears();
  const valid = ["All", ...years];

  if (!valid.includes(window.waterfallState.year)) {
    window.waterfallState.year = "All";
  }

  return window.waterfallState.year;
}

async function getSelectedWaterfallRecord() {
  const [rows, constituency, selectedYear] = await Promise.all([
    getWaterfallData(),
    ensureValidConstituency(),
    ensureValidWaterfallYear()
  ]);

  if (!constituency) return null;

  const constituencyRows = rows.filter((d) => d.constituency === constituency);
  if (!constituencyRows.length) return null;

  if (selectedYear !== "All") {
    return (
      constituencyRows.find(
        (d) => String(d.period) === String(selectedYear)
      ) ?? null
    );
  }

  const colorLookup = getWaterfallColorLookup(constituencyRows);

  const segmentTotals = d3.rollups(
    constituencyRows.flatMap((d) => d.segments ?? []),
    (values) => d3.sum(values, (v) => Number(v.value) || 0),
    (d) => d.Segment
  )
    .map(([Segment, value]) => ({ Segment, value }))
    .sort(
      (a, b) =>
        d3.descending(a.value, b.value) ||
        d3.ascending(a.Segment, b.Segment)
    );

  const total = d3.sum(segmentTotals, (d) => d.value);

  let running = 0;
  const segments = segmentTotals.map((d) => {
    const x1 = running;
    const x2 = running + d.value;
    running = x2;

    return {
      Segment: d.Segment,
      value: d.value,
      color: colorLookup.get(d.Segment) ?? "#1f77b4",
      x1,
      x2,
      share: total > 0 ? d.value / total : 0
    };
  });

  return {
    constituency,
    period: "All",
    total,
    segments
  };
}

await initialiseConstituencySelection();
```

```js
const heroWrap = document.createElement("div");
heroWrap.className = "hero";

const heroVideo = await heroVideoPromise;

heroWrap.innerHTML = `
  <div class="hero__media">
    <video class="hero__video" src="${heroVideo}" autoplay muted loop playsinline></video>
  </div>
  <div class="hero__overlay">
    <div class="hero__content">
      <p class="hero__eyebrow">${sportsFundingTopic.eyebrow}</p>
      <h1 class="hero__title">${sportsFundingTopic.heroTitle}</h1>
      <p class="hero__subtitle">${sportsFundingTopic.heroSubtitle}</p>
    </div>
  </div>
`;

display(heroWrap);
```

<div class="prose-block">
  <p><a href="https://www.gov.ie/en/department-of-culture-communications-and-sport/collections/sports-capital-programme-allocations/" target="_blank">The community sports facilities fund</a>, formerly the sports capital and equipment fund, is the primary means of providing Government funding to sport and community organisations at local, regional and national level throughout the country.</p>
  <p>The programme aims to foster an integrated and planned approach to the development of sports and physical recreation facilities and assists the purchase of non-personal sports equipment. Explore the allocations across constituencies.</p>
  <h2>At a glance</h2>
  <p>
    Explore how the funding has been distributed across projects, organisations and sport types around the country.
  </p>
</div>

```js
display(
  mountReactive(async () => {
    const rows = await getFundingRows();

    const wrap = document.createElement("section");
    wrap.className = "insights-controls";

    wrap.appendChild(
      constituencySelect({
        state: getState(),
        resultsPromise: Promise.resolve(
          rows.map((d) => ({ constituency: d.__constituency }))
        ),
        onChange: () => rerender()
      })
    );

    return wrap;
  })
);
```

```js
display(
  mountReactive(async () => {
    const selectedRows = await getSelectedRows();

    const wrap = document.createElement("section");
    wrap.className = "insights-metrics-full";

    wrap.appendChild(
      metricCards({
        title: null,
        metrics: buildMetricCardData(selectedRows, sportsFundingTopic)
      })
    );

    return wrap;
  })
);
```

<div class="prose-block">
  <h2>Explore the map</h2>
  <p>Using new research from our <strong><a href="https://www.oireachtas.ie/pbo">Parliamentary Budget Office</a></strong>, take an interactive look at how this special funding has been used and compare funding in other constituencies around the country.</p>
</div>

```js
display(
  mountReactive(async () => {
    const geo = await getFilteredConstituencyGeo();
    const rows = await getSelectedRows();

    if (!geo?.features?.length) {
      const p = document.createElement("p");
      p.className = "chart-loading";
      p.textContent = "No map available for this constituency.";
      return p;
    }

    return topicPointMap({
      constituencyGeoJSON: geo,
      data: rows,
      height: 500,
      fields: {
        lat: "__lat",
        lon: "__lon",
        amount: "__amount",
        category: "__category",
        year: "__year",
        entity: "__entity",
        title: "__title"
      },
      labels: sportsFundingTopic.labels,
      palette: sportsFundingTopic.palette,
      tooltipHTML: sportsFundingTopic.tooltipHTML,
      amountFormatter: sportsFundingTopic.formatters.amount
    });
  })
);
```

<div class="prose-block">
  <h2>Explore by sport type</h2>
  <p>
    Funding is broken down by sport categories. Use the filter to view a single allocation year or the combined amount across all years in the data.
  </p>
</div>

```js
display(
  mountReactive(async () => {
    const [years, selectedYear, record, constituency] = await Promise.all([
      getAvailableWaterfallYears(),
      ensureValidWaterfallYear(),
      getSelectedWaterfallRecord(),
      ensureValidConstituency()
    ]);

    const wrap = document.createElement("div");
    wrap.className = "section-local-control section-local-control--waterfall";

    const intro = document.createElement("div");
    intro.className = "section-local-control__intro";
    intro.innerHTML = `
      <p>
        Funding is broken down by sport categories. Use the filter to view a single allocation year or the combined amount across all years in the data.
      </p>
    `;

    const summary = document.createElement("div");
    summary.className = "section-local-control__summary";
    summary.innerHTML = record?.total
      ? `
        <p>
          <strong>Total funding in ${constituency} for ${
            record.period === "All" ? "all years" : record.period
          }:</strong>
          ${euro(record.total)}
        </p>
      `
      : `<p>No funding breakdown available for this selection.</p>`;

    const control = document.createElement("div");
    control.className = "section-local-control__control section-local-control__control--centered";

    control.appendChild(
      renderSegmentedControl({
        label: "Filter sport type chart by year",
        name: "waterfall-year",
        value: selectedYear,
        options: [
          { value: "All", label: "All" },
          ...years.map((year) => ({ value: year, label: year }))
        ],
        onChange: (nextValue) => {
          window.waterfallState.year = nextValue;
          rerenderWaterfall();
        }
      })
    );

    wrap.appendChild(intro);
    wrap.appendChild(summary);
    wrap.appendChild(control);

    return wrap;
  }, { eventName: "waterfall:change" })
);
```

<div class="chart-block chart-block--wide">

```js
display(
  mountReactive(async () => {
    const record = await getSelectedWaterfallRecord();

    if (!record?.segments?.length) {
      return chartPlaceholder(
        260,
        "No funding breakdown available for this selection."
      );
    }

    const wrap = document.createElement("div");
    wrap.className = "election-chart-wrap";

    wrap.appendChild(
      waterfallSegmentsChart(record.segments, {
        width: Math.max(760, 790),
        minRowHeight: 28
      })
    );

    return wrap;
  }, { eventName: "waterfall:change" })
);
```

</div>

```js
display(
  mountReactive(async () => {
    const members = await getMatchedMembers();
    const constituency = await ensureValidConstituency();

    return memberCards({
      members,
      partyColorMap,
      title: resolveLabel(sportsFundingTopic.labels.memberCardsTitle, {
        constituency
      })
    });
  })
);
```

<div class="prose-block">
  <h2>Explore parliamentary questions</h2>
  <p>
    Take a look at recent parliamentary questions related to sport and sports funding from Deputies in the constituency.
  </p>
</div>

<div class="chart-block">

```js
display(
  mountReactive(async () => {
    const rows = await getRecentSportsPQsForConstituency(10);

    if (!rows.length) {
      const p = document.createElement("p");
      p.className = "chart-loading";
      p.textContent = "No related parliamentary questions available for this constituency.";
      return p;
    }

    const wrap = document.createElement("div");
    wrap.className = "debates-list debates-list--pqs";

    rows.forEach((d) => {
      const row = document.createElement("article");
      row.className = "debates-list__row debates-list__row--pqs";

      const borderColor = partyColorMap.get(d.matchedParty) ?? "#666666";

      const avatarMarkup = d.imageUrl
        ? `
          <div class="debates-list__avatar" style="--avatar-ring:${borderColor}">
            <img src="${d.imageUrl}" alt="${d.deputy}" loading="lazy" />
          </div>
        `
        : `
          <div class="debates-list__avatar debates-list__avatar--placeholder" style="--avatar-ring:${borderColor}">
            <span>${d.initials}</span>
          </div>
        `;

      row.innerHTML = `
        <div class="debates-list__date">
          ${formatIrishDate(d.date)}
        </div>

        <div class="debates-list__topic debates-list__topic--with-avatar">
          ${avatarMarkup}
          <div class="debates-list__topic-main">
            <div class="debates-list__topic-title">${d.heading ?? ""}</div>
            <div class="debates-list__topic-meta">${d.deputy ?? ""}</div>
          </div>
        </div>

        <div class="debates-list__action">
          <a
            class="debates-list__button"
            href="${d.url}"
            target="_blank"
            rel="noreferrer"
          >
            View
          </a>
        </div>
      `;

      wrap.appendChild(row);
    });

    return wrap;
  })
);
```

</div>

<div class="prose-block">
  <h2>Explore debates</h2>
  <p>
    Read the most recent Dáil debates related to sports and community funding.
  </p>
</div>

<div class="chart-block">

```js
display(
  mountReactive(async () => {
    const debates = await getRecentSportsDebates(5);

    if (!debates.length) {
      const p = document.createElement("p");
      p.className = "chart-loading";
      p.textContent = "No related debates available.";
      return p;
    }

    const wrap = document.createElement("div");
    wrap.className = "debates-list";

    debates.forEach((d) => {
      const row = document.createElement("article");
      row.className = "debates-list__row";

      row.innerHTML = `
        <div class="debates-list__date">${formatIrishDate(d.date)}</div>
        <div class="debates-list__topic">${d.topic ?? ""}</div>
        <div class="debates-list__action">
          <a
            class="debates-list__button"
            href="${d.webpage}"
            target="_blank"
            rel="noreferrer"
          >
            View
          </a>
        </div>
      `;

      wrap.appendChild(row);
    });

    return wrap;
  })
);
```

</div>

```js
display(
  mountReactive(async () => {
    const rows = await getFundingRows();

    const wrap = document.createElement("div");
    wrap.className = "download-block";

    wrap.appendChild(
      downloadButton(
        rows.map((d) => ({
          year: d.__year ?? "",
          constituency: d.__constituency ?? "",
          project: d.__title ?? "",
          organisation: d.__entity ?? "",
          sport_type: d.__category ?? "",
          amount: d.__amount ?? 0,
          lat: d.__lat ?? "",
          lon: d.__lon ?? ""
        })),
        "sports-funding-complete-dataset.csv",
        {
          label: "Download the complete sports funding dataset"
        }
      )
    );

    return wrap;
  })
);
```
