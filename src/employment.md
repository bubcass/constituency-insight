---
title: "Work"
header: false
sidebar: false
footer: false
toc: false
---

```js
import * as d3 from "npm:d3@7.9.0";
import { insightsTabs } from "./components/insights-tabs.js";
import { constituencySelect } from "./components/constituency-select.js";
import { detectConstituencyFromLocation, readSavedConstituency, saveSelectedConstituency } from "./components/constituency-location.js";
import { metricCards } from "./components/metric-cards.js";
import { downloadButton } from "./components/download-button.js";
import { electoralDistrictMap } from "./components/electoral-district-map.js";
import { employmentWaffle } from "./components/employment-charts.js";
import { principalEconomicStatusWaterfall } from "./components/people-charts.js";
import { percentageStripChart } from "./components/percentage-strip-chart.js";
import { chartColors } from "./config/chart-palette.js";
import { memberCards } from "./components/member-cards.js";
import { membersForConstituency } from "./components/member-data.js";
import { parliamentaryQuestionList, memberContributionList } from "./components/parliamentary-activity.js";
import { relatedResearchResource } from "./components/related-research.js";
import { createReactiveMount } from "./components/reactive-mount.js";
import { enhanceHeroWithShare } from "./components/hero-share.js";

const employmentData = await FileAttachment("data/employment-industry-2022.csv").csv({typed: true});
const occupationData = await FileAttachment("data/employment-occupation-2022.csv").csv({typed: true});
const economicStatusData = await FileAttachment("data/principal-economic-status-2022.csv").csv({typed: true});
const workingFromHomeData = await FileAttachment("data/working-from-home-2022.csv").csv({typed: true});
const householdIncomeData = await FileAttachment("data/household-income-2022.csv").csv({typed: true});
const districtGeo = await FileAttachment("data/geo/electoral-districts-2022.geojson").json();
const constituenciesGeo = await FileAttachment("data/geo/constituencies.json").json();
const membersLookup = await FileAttachment("data/members-lookup.json").json();
const recentQuestionsByConstituency = await FileAttachment("data/derived/recent-work-questions.json").json();
const recentWorkContributions = await FileAttachment("data/derived/recent-work-contributions.json").json();
const workHeroVideo = await FileAttachment("media/harvest-hero.mp4").url();

const WORK_MATCHER = /\b(?:work(?:er|ers|ing|place|places)?|employment|jobs?)\b/i;
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
  ["Green Party", "#b4d143"]
]);

const INDUSTRIES = [
  "Agriculture, forestry and fishing",
  "Building and construction",
  "Manufacturing industries",
  "Commerce and trade",
  "Transport and communications",
  "Public administration",
  "Professional services",
  "Other"
];

const OCCUPATIONS = [
  "Managers, Directors and Senior Officials",
  "Professional Occupations",
  "Associate Professional and Technical Occupations",
  "Administrative and Secretarial Occupations",
  "Skilled Trades Occupations",
  "Caring, Leisure and Other Service Occupations",
  "Sales and Customer Service Occupations",
  "Process, Plant and Machine Operatives",
  "Elementary Occupations"
];

const ECONOMIC_STATUSES = [
  "At work",
  "Looking for first regular job",
  "Short term unemployed",
  "Long term unemployed",
  "Student",
  "Looking after home/family",
  "Retired",
  "Unable to work due to permanent sickness or disability",
  "Other"
];

if (typeof window !== "undefined" && !window.employmentState) {
  window.employmentState = {constituency: null, district: "all", profileView: "industry"};
}

const state = window.employmentState;
if (!new Set(["industry", "occupation"]).has(state.profileView)) state.profileView = "industry";
const constituencies = Array.from(
  new Set(employmentData.map((d) => d["NEW CONSTITUENCY"]).filter(Boolean))
).sort((a, b) => a.localeCompare(b, "en"));
const savedConstituency = readSavedConstituency(constituencies);

if (savedConstituency) {
  state.constituency = savedConstituency;
} else {
  if (!constituencies.includes(state.constituency)) state.constituency = constituencies[0] ?? null;
  const detected = await detectConstituencyFromLocation({
    constituencyGeoJSON: constituenciesGeo,
    availableConstituencies: constituencies,
    prompt: false
  });
  if (detected.ok) state.constituency = detected.constituency;
}

function rowsForConstituency() {
  return employmentData.filter((d) => d["NEW CONSTITUENCY"] === state.constituency);
}

function rowsForDistrict() {
  const rows = rowsForConstituency();
  return state.district === "all" ? rows : rows.filter((d) => d.ED_GUID === state.district);
}

function occupationRowsForDistrict() {
  const rows = occupationData.filter((d) => d["NEW CONSTITUENCY"] === state.constituency);
  return state.district === "all" ? rows : rows.filter((d) => d.ED_GUID === state.district);
}

function rowsForSelectedArea(data) {
  return data.filter((d) =>
    d["NEW CONSTITUENCY"] === state.constituency &&
    (state.district === "all" || d.ED_GUID === state.district)
  );
}

function economicStatusProfile() {
  const rows = rowsForSelectedArea(economicStatusData);
  return ECONOMIC_STATUSES.map((economicStatus) => ({
    economicStatus,
    total: d3.sum(rows, (row) => Number(row[economicStatus]) || 0)
  }));
}

function economicStatusPopulation() {
  return d3.sum(rowsForSelectedArea(economicStatusData), (row) => Number(row.Total) || 0);
}

function constituencyMembers() {
  return membersForConstituency(membersLookup, state.constituency);
}

function recentConstituencyWorkQuestions(limit = 6) {
  const record = recentQuestionsByConstituency.find((entry) => entry.constituency === state.constituency);
  return (record?.questions ?? [])
    .filter((question) => WORK_MATCHER.test(`${question.heading ?? ""} ${question.question ?? ""}`))
    .slice()
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))
    .slice(0, limit);
}

function recentConstituencyWorkContributions(limit = 6, perMemberLimit = 3) {
  const memberCodes = new Set(constituencyMembers().map((member) => member.memberCode).filter(Boolean));
  const memberCounts = new Map();
  return recentWorkContributions
    .filter((contribution) => memberCodes.has(contribution.memberCode))
    .slice()
    .sort((a, b) => {
      const dateComparison = String(b.date ?? "").localeCompare(String(a.date ?? ""));
      return dateComparison || Number(b.sectionNumber ?? 0) - Number(a.sectionNumber ?? 0);
    })
    .filter((contribution) => {
      const count = memberCounts.get(contribution.memberCode) ?? 0;
      if (count >= perMemberLimit) return false;
      memberCounts.set(contribution.memberCode, count + 1);
      return true;
    })
    .slice(0, limit);
}

function aggregateEmployment(rows = rowsForDistrict()) {
  return INDUSTRIES.map((industry) => ({
    sector: industry,
    total: d3.sum(rows, (row) => Number(row[`${industry} (Both Sexes)`]) || 0)
  }));
}

function aggregateOccupations(rows = occupationRowsForDistrict()) {
  return OCCUPATIONS.map((occupation) => ({
    sector: occupation,
    total: d3.sum(rows, (row) => Number(row[`${occupation} (Both Sexes)`]) || 0)
  }));
}

function employmentStats(rows = rowsForDistrict()) {
  const profile = aggregateEmployment(rows);
  const total = d3.sum(profile, (d) => d.total) || 1;
  const largest = d3.greatest(profile, (d) => d.total);
  const value = (labels) => d3.sum(profile.filter((d) => labels.includes(d.sector)), (d) => d.total);
  return {
    profile,
    total,
    largest,
    professionalServicesShare: value(["Professional services"]) / total,
    productionShare: value(["Building and construction", "Manufacturing industries"]) / total
  };
}

function workingFromHomeStats(rows = rowsForSelectedArea(workingFromHomeData)) {
  const worksFromHome = d3.sum(rows, (row) => Number(row["Persons who work from home"]) || 0);
  const neverWorksFromHome = d3.sum(rows, (row) => Number(row["Persons who never work from home"]) || 0);
  const notStated = d3.sum(rows, (row) => Number(row["Work From Home status - Not stated"]) || 0);
  const stated = worksFromHome + neverWorksFromHome;
  return {worksFromHome, neverWorksFromHome, notStated, stated, share: stated ? worksFromHome / stated : 0};
}

function labourForceStats(rows = rowsForSelectedArea(economicStatusData)) {
  const atWork = d3.sum(rows, (row) => Number(row["At work"]) || 0);
  const firstJob = d3.sum(rows, (row) => Number(row["Looking for first regular job"]) || 0);
  const shortTerm = d3.sum(rows, (row) => Number(row["Short term unemployed"]) || 0);
  const longTerm = d3.sum(rows, (row) => Number(row["Long term unemployed"]) || 0);
  const unemployed = firstJob + shortTerm + longTerm;
  const labourForce = atWork + unemployed;
  return {
    atWork,
    firstJob,
    shortTerm,
    longTerm,
    unemployed,
    labourForce,
    unemploymentRate: labourForce ? unemployed / labourForce : 0
  };
}

function selectedDistrictHouseholdIncome() {
  if (state.district === "all") return null;
  const row = householdIncomeData.find((d) => d.ED_GUID === state.district);
  if (!row) return null;
  return {
    median: Number(row["Median Gross Household Income"]) || 0,
    mean: Number(row["Mean Gross Household Income"]) || 0,
    nationalMedian: Number(row["Ireland Median Gross Household Income"]) || 0,
    nationalMean: Number(row["Ireland Mean Gross Household Income"]) || 0
  };
}

const nationalStats = employmentStats(employmentData);
const nationalWorkingFromHomeStats = workingFromHomeStats(workingFromHomeData);

function districtOptions() {
  return rowsForConstituency()
    .map((d) => ({value: d.ED_GUID, label: d.GEOGDESC}))
    .sort((a, b) => a.label.localeCompare(b.label, "en"));
}

function selectedDistrictName() {
  if (state.district === "all") return state.constituency;
  return districtOptions().find((d) => d.value === state.district)?.label ?? "Selected district";
}

function scopeLabel() {
  return state.district === "all" ? state.constituency : selectedDistrictName();
}

function ensureDistrict() {
  const valid = new Set(districtOptions().map((d) => d.value));
  if (state.district !== "all" && !valid.has(state.district)) state.district = "all";
}

function selectedConstituencyGeoJSON() {
  return {
    type: "FeatureCollection",
    features: constituenciesGeo.features.filter(
      (feature) => String(feature?.properties?.ENG_NAME_VALUE ?? "").replace(/\s*\(\d+\)\s*$/, "").trim() === state.constituency
    )
  };
}

function differenceText(value, comparison = "national profile") {
  const points = Math.abs(value * 100).toFixed(1);
  if (Math.abs(value) < 0.0005) return `in line with the ${comparison}`;
  return `${points} percentage point${points === "1.0" ? "" : "s"} ${value > 0 ? "above" : "below"} the ${comparison}`;
}

function currencyDifferenceText(value, comparison) {
  const difference = value - comparison;
  if (Math.abs(difference) < 1) return "in line with the national figure";
  return `€${d3.format(",.0f")(Math.abs(difference))} ${difference > 0 ? "above" : "below"} the national figure`;
}

function restoreScroll(x, y) {
  const restore = () => window.scrollTo(x, y);
  restore();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    restore();
    setTimeout(restore, 60);
  }));
}

function rerender({preserveScroll = true} = {}) {
  const x = window.scrollX;
  const y = window.scrollY;
  window.dispatchEvent(new CustomEvent("employment:change"));
  if (preserveScroll) restoreScroll(x, y);
}

function mountReactive(renderFn, options = {}) {
  return createReactiveMount(renderFn, {
    eventName: "employment:change",
    ...options
  });
}

function renderScopeControl() {
  const wrap = document.createElement("section");
  wrap.className = "insights-controls employment-scope-control";
  wrap.appendChild(constituencySelect({
    state,
    resultsPromise: Promise.resolve(constituencies.map((constituency) => ({constituency}))),
    onChange: () => {
      state.district = "all";
      saveSelectedConstituency(state.constituency);
      rerender();
    },
    onLocate: () => detectConstituencyFromLocation({
      constituencyGeoJSON: constituenciesGeo,
      availableConstituencies: constituencies,
      prompt: true
    })
  }));
  return wrap;
}

function renderProfileViewControl() {
  const wrap = document.createElement("div");
  wrap.className = "segmented-control-wrap employment-profile-control";
  const group = document.createElement("div");
  group.className = "segmented-control";
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", "Employment profile view");
  const options = [
    {value: "industry", label: "Industry profile"},
    {value: "occupation", label: "Occupation profile"}
  ];
  for (const option of options) {
    const label = document.createElement("label");
    label.className = "segmented-control__option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "employment-profile-view";
    input.value = option.value;
    input.checked = state.profileView === option.value;
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.profileView = option.value;
      rerender();
    });
    const text = document.createElement("span");
    text.textContent = option.label;
    label.append(input, text);
    group.appendChild(label);
  }
  wrap.appendChild(group);
  return wrap;
}

function renderDistrictMapExplorer() {
  const section = document.createElement("section");
  section.className = "demographics-map-explorer employment-map-explorer";
  const mapHost = document.createElement("div");
  mapHost.className = "demographics-map-explorer__map-host";
  section.appendChild(mapHost);
  let mapNode = null;
  let renderedConstituency = null;

  function buildMap() {
    mapNode?.destroy?.();
    mapHost.replaceChildren();
    const guids = new Set(rowsForConstituency().map((d) => d.ED_GUID));
    const features = districtGeo.features.filter((feature) => guids.has(feature?.properties?.ED_GUID));
    mapNode = electoralDistrictMap({
      constituencyGeoJSON: selectedConstituencyGeoJSON(),
      districtGeoJSON: {type: "FeatureCollection", features},
      selectedGuid: state.district,
      height: 500,
      onSelect: (guid) => {
        if (!guid || guid === state.district) return;
        state.district = guid;
        rerender();
      }
    });
    renderedConstituency = state.constituency;
    mapHost.appendChild(mapNode);
  }

  function update() {
    ensureDistrict();
    if (!mapNode || renderedConstituency !== state.constituency) buildMap();
    else mapNode.setSelectedGuid?.(state.district);
  }
  update();
  window.addEventListener("employment:change", update);
  return section;
}

const EMPLOYMENT_CHART_WIDTH = 790;
```

```js
const hero = document.createElement("div");
hero.className = "hero employment-hero";
hero.innerHTML = `
  <div class="hero__media">
    <video class="hero__video" src="${workHeroVideo}" autoplay muted loop playsinline aria-hidden="true"></video>
  </div>
  <div class="hero__overlay">
    <div class="hero__content">
      <p class="hero__eyebrow">Constituency insights</p>
      <h1 class="hero__title">Work</h1>
      <p class="hero__subtitle">Explore where people at work in each constituency are employed.</p>
    </div>
  </div>
`;
enhanceHeroWithShare(hero, {title: "Work — Constituency Insights"});
display(hero);
```

```js
display(insightsTabs("employment"));
```

<div class="prose-block lead">
  <p>Data from the most recent census indicates where people around the country work and what they do. Choose a constituency to explore work and industry profiles or see local detail by selecting a district.</p>
</div>

```js
display(renderScopeControl());
```

```js
display(renderDistrictMapExplorer());
```

```js
display(mountReactive(async () => {
  const stats = employmentStats();
  const note = document.createElement("div");
  note.className = "reactive-prose demographic-story-callout";
  const label = document.createElement("p");
  label.className = "demographic-story-callout__label";
  label.textContent = "At a glance";
  const heading = document.createElement("h2");
  heading.textContent = `${stats.largest.sector} is the largest employment sector in ${scopeLabel()}.`;
  const context = document.createElement("div");
  context.className = "demographic-scope-context";
  const scope = document.createElement("p");
  scope.className = "demographic-scope-context__copy";
  scope.textContent = state.district === "all"
    ? `${state.constituency} is a constituency with ${d3.format(",")(rowsForConstituency().length)} electoral districts in this dataset.`
    : `${selectedDistrictName()} is an electoral district in the ${state.constituency} constituency.`;
  context.appendChild(scope);
  if (state.district !== "all") {
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "demographic-scope-context__clear";
    clear.setAttribute("aria-label", `Clear ${selectedDistrictName()} electoral district selection`);
    clear.innerHTML = `<span class="demographic-scope-context__clear-icon" aria-hidden="true">×</span><span>Clear district</span>`;
    clear.addEventListener("click", () => { state.district = "all"; rerender(); });
    context.appendChild(clear);
  }
  const detail = document.createElement("p");
  detail.innerHTML = `<strong>${d3.format(".1%")(stats.largest.total / stats.total)}</strong> of people at work in the selected area are employed in this sector.`;
  note.append(label, heading, context, detail);
  return note;
}, {skeleton: "text"}));
```

```js
display(mountReactive(async () => {
  const stats = employmentStats();
  const homeStats = workingFromHomeStats();
  const cards = metricCards({metrics: [
    {label: "People at work", value: d3.format(",")(stats.total), note: "Census 2022"},
    {label: "Works from home", value: d3.format(".1%")(homeStats.share), note: differenceText(homeStats.share - nationalWorkingFromHomeStats.share, "national figure")},
    {label: "Professional services", value: d3.format(".1%")(stats.professionalServicesShare), note: differenceText(stats.professionalServicesShare - nationalStats.professionalServicesShare)},
    {label: "Production and construction", value: d3.format(".1%")(stats.productionShare), note: differenceText(stats.productionShare - nationalStats.productionShare)}
  ]});
  const wrap = document.createElement("section");
  wrap.className = "insights-metrics-full employment-metrics";
  wrap.appendChild(cards);
  return wrap;
}, {skeleton: "cards"}));
```

<div class="prose-block prose-block--section">
  <h2>What people do</h2>
  <p>Census data on economic status indicates whether people aged 15 and over are studying, working, looking for work, unable to work or retired.</p>
</div>

<div class="chart-block chart-block--wide">

```js
display(mountReactive(async () => principalEconomicStatusWaterfall(economicStatusProfile(), {
  width: 1000,
  title: `Principal economic status in ${scopeLabel()}`,
  subtitle: `Population aged 15 and over as at Census 2022 · n = ${d3.format(",")(economicStatusPopulation())}`
})));
```

</div>

<div class="prose-block">
  <h2>Work profile</h2>
  <p>Take a look at the type of industries where people work and the type or roles that workers fill.</p>
</div>

<div class="employment-profile-control-block">

```js
display(mountReactive(async () => renderProfileViewControl()));
```

</div>

<div class="chart-block chart-block--wide">

```js
display(mountReactive(async () => {
  const isIndustry = state.profileView === "industry";
  const profile = isIndustry ? employmentStats().profile : aggregateOccupations();
  const total = d3.sum(profile, (d) => d.total);
  return employmentWaffle(profile, {
    width: EMPLOYMENT_CHART_WIDTH,
    title: `${isIndustry ? "Industry" : "Occupation"} profile for ${scopeLabel()}`,
    subtitle: `Census 2022 · n = ${d3.format(",")(total)}${isIndustry ? "" : " stated responses"}`,
    populationContext: isIndustry ? "people at work" : "people at work or unemployed with a stated occupation",
    note: isIndustry
      ? "Each dot represents 1% of people at work in the selected area."
      : "Each dot represents 1% of people at work or unemployed with a stated occupation in the selected area."
  });
}, {skeleton: "cards"}));
```

</div>

```js
display(mountReactive(async () => {
  const income = selectedDistrictHouseholdIncome();
  if (!income) return document.createDocumentFragment();

  const card = document.createElement("section");
  card.className = "reactive-prose demographic-story-callout";

  const label = document.createElement("p");
  label.className = "demographic-story-callout__label";
  label.textContent = "At a glance";

  const heading = document.createElement("h2");
  heading.textContent = `Gross median household income in ${scopeLabel()} was €${d3.format(",.0f")(income.median)}.`;

  const detail = document.createElement("p");
  detail.innerHTML = `Gross mean household income was <strong>€${d3.format(",.0f")(income.mean)}</strong> in 2022.`;

  const comparison = document.createElement("p");
  comparison.innerHTML = `The median was <strong>${currencyDifferenceText(income.median, income.nationalMedian)}</strong> (€${d3.format(",.0f")(income.nationalMedian)} nationally); the mean was <strong>${currencyDifferenceText(income.mean, income.nationalMean)}</strong> (€${d3.format(",.0f")(income.nationalMean)} nationally).`;

  card.append(label, heading, detail, comparison);
  return card;
}, {skeleton: "text"}));
```

<div class="prose-block">
  <h2>Labour force status as of Census 2022</h2>
  <p>Census 2022 provides a snapshot of the proportions of populations employed and those seeking working as of April 2022. The latter includes first-time job seekers and people in short- or long-term unemployment. People outside the labour force are not included.</p><p>The CSO maintains current employment data<a href="https://www.cso.ie/en/statistics/labourmarket/" target="_blank" rel="noreferrer">, including monthly unemployment and live register information</a>.</p>
</div>

<div class="chart-block chart-block--wide">

```js
display(mountReactive(async () => {
  const stats = labourForceStats();
  return percentageStripChart([
    {category: "At work", total: stats.atWork, color: chartColors.blue},
    {category: "Unemployed", total: stats.unemployed, color: chartColors.red}
  ], {
    width: EMPLOYMENT_CHART_WIDTH,
    title: `Census 2022 labour force status in ${scopeLabel()}`,
    subtitle: `Census 2022 · n = ${d3.format(",")(stats.labourForce)}`,
    itemLabel: "people",
    shareLabel: "of the labour force",
    noteHtml: `Each stripe represents approximately 1% of the Census-defined labour force. People outside the labour force are excluded. <strong>Census 2022 unemployment rate: ${d3.format(".1%")(stats.unemploymentRate)}</strong>`,
    ariaLabel: `Census 2022 labour-force status in ${scopeLabel()}`
  });
}, {skeleton: "cards"}));
```

</div>


```js
display(mountReactive(async () => memberCards({
  members: constituencyMembers().map((member) => ({
    ...member,
    displayName: member.memberName,
    matchedParty: member.party,
    imageUrl: member.memberCode
      ? `https://data.oireachtas.ie/ie/oireachtas/member/id/${member.memberCode}/image/large`
      : null
  })),
  partyColorMap,
  title: `How ${state.constituency} is represented in Parliament`
}), {skeleton: "table"}));
```

<div class="prose-block">
  <h2>Recent parliamentary questions related to work</h2>
  <p>Read recent parliamentary questions tabled by ${state.constituency} TDs related to work and employment.</p>
</div>

<div class="chart-block">

```js
display(mountReactive(async () => parliamentaryQuestionList({
  rows: recentConstituencyWorkQuestions(6),
  members: constituencyMembers(),
  partyColorMap,
  emptyMessage: "No recent work-related parliamentary questions are available for this constituency."
}), {skeleton: "table"}));
```

</div>

<div class="prose-block">
  <h2>Recent speeches related to work</h2>
  <p>Read recent contributions in Dáil Éireann by the TDs who represent ${state.constituency}.</p>
</div>

<div class="chart-block">

```js
display(mountReactive(async () => memberContributionList({
  rows: recentConstituencyWorkContributions(6),
  members: constituencyMembers(),
  partyColorMap,
  emptyMessage: "No recent work-related Dáil contributions are available for this constituency."
})));
```

</div>

<div class="prose-block prose-block--section">
  <h2>Explore our research</h2>
  <p>Our research and analysis takes a deep dive into employment and related topics.</p>
</div>

<div class="chart-block">

```js
display(relatedResearchResource({
  rows: [{
    date: "2026-07-15",
    author: "L&RS",
    authorUrl: "https://www.oireachtas.ie/en/how-parliament-is-run/houses-of-the-oireachtas-service/library-and-research-service/",
    title: "Briefing: Social Welfare and Other Matters Bill 2026",
    url: "https://data.oireachtas.ie/ie/oireachtas/libraryResearch/2026/2026-07-15_briefing-paper-general-scheme-of-the-social-welfare-and-other-matters-bill-2026_en.pdf"
  },
  {
    date: "2025-10-03",
    author: "PBO",
    authorUrl: "https://www.oireachtas.ie/en/how-parliament-is-run/houses-of-the-oireachtas-service/parliamentary-budget-office/",
    title: "Costing Analysis on Increasing Employers PRSI Rate",
    url: "https://data.oireachtas.ie/ie/oireachtas/parliamentaryBudgetOffice/2025/2025-10-03_costing-analysis-on-increasing-employers-prsi-rate_en.pdf"
  },]
}));
```

</div>

<div class="prose-block demographics-source-note">
  <h2>About the data</h2>
  <p>Data collected for <a href="https://www.cso.ie/en/statistics/population/censusofpopulation2022/censusofpopulation2022-summaryresults/" target="_blank" rel="noreferrer">Census 2022</a> by the CSO underpins Constituency Insights.</p>
  <p>Industry counts are from Census 2022 table SAP2022T14T1ED and describe persons at work by broad industry group. Occupation counts are from table SAP2022T13T1ED and describe people at work or unemployed; “Not stated” responses are excluded from the occupation profile. Principal economic and labour-force status comes from table SAP2022T8T1ED. Its Census unemployment rate is the number seeking a first job or in short- or long-term unemployment divided by the labour force. Working-from-home counts come from table SAP2022T11T4ED, with “Not stated” excluded from the card percentage. ED household-income estimates are from the CSO Frontier Series table GPIIA01 and are shown only when an ED is selected because the table does not contain Dáil constituency estimates. They use available administrative income data, exclude households with no administrative income and are not the official SILC household-income measure. The datasets are joined by CSO electoral-division GUID and, except for income, aggregated to the current Dáil constituency boundaries.</p><p>View the source CSO datasets for <a href="https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/SAP2022T14T1ED/JSON-stat/2.0/en" target="_blank" rel="noreferrer">industry</a>, <a href="https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/SAP2022T13T1ED/JSON-stat/2.0/en" target="_blank" rel="noreferrer">occupation</a>, <a href="https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/SAP2022T8T1ED/JSON-stat/2.0/en" target="_blank" rel="noreferrer">principal economic and labour-force status</a>, <a href="https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/SAP2022T11T4ED/JSON-stat/2.0/en" target="_blank" rel="noreferrer">working from home</a> and <a href="https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/GPIIA01/JSON-stat/2.0/en" target="_blank" rel="noreferrer">ED household income</a>.</p>
</div>

```js
display(mountReactive(async () => {
  const wrap = document.createElement("div");
  wrap.className = "download-block";
  wrap.appendChild(downloadButton(
    rowsForDistrict().flatMap((district) => aggregateEmployment([district]).map((row) => ({
      constituency: district["NEW CONSTITUENCY"],
      electoral_district: district.GEOGDESC,
      electoral_district_id: district.ED_GUID,
      industry: row.sector,
      people: row.total
    }))),
    `${scopeLabel().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-employment-2022.csv`,
    {label: `Download employment data for ${scopeLabel()}`}
  ));
  return wrap;
}, {skeleton: "text"}));
```
