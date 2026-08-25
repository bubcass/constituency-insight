---
title: "Education"
header: false
sidebar: false
footer: false
toc: false
---

```js
import * as d3 from "npm:d3@7.9.0";
import {insightsTabs} from "./components/insights-tabs.js";
import {constituencySelect} from "./components/constituency-select.js";
import {detectConstituencyFromLocation, readSavedConstituency, saveSelectedConstituency} from "./components/constituency-location.js";
import {electoralDistrictMap} from "./components/electoral-district-map.js";
import {memberCards} from "./components/member-cards.js";
import {metricCards} from "./components/metric-cards.js";
import {membersForConstituency} from "./components/member-data.js";
import {parliamentaryQuestionList, memberContributionList} from "./components/parliamentary-activity.js";
import {relatedResearchResource} from "./components/related-research.js";
import {createReactiveMount} from "./components/reactive-mount.js";
import {enhanceHeroWithShare} from "./components/hero-share.js";
import {educationQualificationWaterfall, educationCeasedAgeWaffle, irishLanguagePercentageBar} from "./components/education-charts.js";
import {downloadButton} from "./components/download-button.js";
import {chartPalette} from "./config/chart-palette.js";
import {tabularRows} from "./components/tabular-data.js";

const constituencyRows = tabularRows(await FileAttachment("data/derived/browser/demographics-age-2022.json").json());
const educationQualification = tabularRows(await FileAttachment("data/derived/browser/education-qualification-2022.json").json());
const educationParticipation = tabularRows(await FileAttachment("data/derived/browser/education-participation-2022.json").json());
const irishSpeakingFrequency = tabularRows(await FileAttachment("data/derived/browser/irish-speaking-frequency-2022.json").json());
const districtGeo = await FileAttachment("data/geo/electoral-districts-2022.geojson").json();
const constituenciesGeo = await FileAttachment("data/geo/constituencies.json").json();
const membersLookup = await FileAttachment("data/members-lookup.json").json();
const recentQuestionsByConstituency = await FileAttachment("data/derived/recent-education-questions.json").json();
const recentEducationContributions = await FileAttachment("data/derived/recent-education-contributions.json").json();
const educationHeroVideo = await FileAttachment("media/education-hero.mp4").url();

const EDUCATION_HEADING_MATCHER = /\b(?:education|schools?|teachers?|pupils?|students?|classrooms?|special education|universit(?:y|ies)|colleges?|third[- ]level|further education|higher education|apprenticeships?|early learning|childcare)\b/i;
const EDUCATION_LEVELS = [
  "No formal education",
  "Primary education",
  "Lower secondary",
  "Upper secondary",
  "Technical or vocational qualification",
  "Advanced certificate/Completed apprenticeship",
  "Higher certificate",
  "Ordinary bachelor degree or national diploma",
  "Honours bachelor degree, professional qualification or both",
  "Postgraduate diploma or degree",
  "Doctorate(Ph.D) or higher",
  "Not stated"
];
const EDUCATION_CEASED_AGES = [
  "Age under 15",
  "Age 15",
  "Age 16",
  "Age 17",
  "Age 18",
  "Age 19",
  "Age 20",
  "Age 21 and over",
  "Not stated"
];
const IRISH_FREQUENCIES = [
  "Speaks Irish daily within the education system only",
  "Speaks Irish daily",
  "Speaks Irish weekly",
  "Speaks Irish less often",
  "Never speaks Irish outside the education system only",
  "Not stated"
];
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

if (typeof window !== "undefined" && !window.educationState) {
  window.educationState = {constituency: null, district: "all"};
}

const state = window.educationState;
if (!state.district) state.district = "all";
if (!state.irishView) state.irishView = "ability";
const constituencies = Array.from(
  new Set(constituencyRows.map((d) => d["NEW CONSTITUENCY"]).filter(Boolean))
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
  return constituencyRows.filter((d) => d["NEW CONSTITUENCY"] === state.constituency);
}

function educationRowsForScope() {
  return educationQualification.filter((d) =>
    d["NEW CONSTITUENCY"] === state.constituency &&
    (state.district === "all" || d.ED_GUID === state.district)
  );
}

function rowsForSelectedArea(rows) {
  return rows.filter((d) =>
    d["NEW CONSTITUENCY"] === state.constituency &&
    (state.district === "all" || d.ED_GUID === state.district)
  );
}

function educationProfile() {
  const rows = educationRowsForScope();
  return EDUCATION_LEVELS.map((qualification) => ({
    qualification,
    total: d3.sum(rows, (row) => Number(row[qualification]) || 0)
  }));
}

function educationPopulation() {
  return d3.sum(educationRowsForScope(), (row) => Number(row.Total) || 0);
}

function participationProfile(rows = rowsForSelectedArea(educationParticipation)) {
  const stillAtSchool = d3.sum(rows, (row) => Number(row["Still at school or college"]) || 0);
  const otherNotCeased = d3.sum(rows, (row) => Number(row["Other education not ceased"]) || 0);
  const ceased = d3.sum(rows, (row) => Number(row["Education ceased"]) || 0);
  const population15Plus = d3.sum(rows, (row) => Number(row["Population aged 15 and over"]) || 0);
  return {
    stillAtSchool,
    otherNotCeased,
    ceased,
    population15Plus,
    share: population15Plus > 0 ? stillAtSchool / population15Plus : 0
  };
}

const nationalParticipation = participationProfile(educationParticipation);

function ceasedAgeProfile() {
  const rows = rowsForSelectedArea(educationParticipation);
  return EDUCATION_CEASED_AGES.map((label) => ({
    label: label.replace(/^Age /, ""),
    total: d3.sum(rows, (row) => Number(row[label]) || 0)
  }));
}

function populationAgedThreePlus(rows = constituencyRows) {
  return d3.sum(rowsForSelectedArea(rows), (row) =>
    (Number(row.Total) || 0) -
    (Number(row["Age 0 - Total"]) || 0) -
    (Number(row["Age 1 - Total"]) || 0) -
    (Number(row["Age 2 - Total"]) || 0)
  );
}

function irishSpeakerPopulation(rows = rowsForSelectedArea(irishSpeakingFrequency)) {
  return d3.sum(rows, (row) => Number(row["All Irish speakers"]) || 0);
}

function irishSpeakerProfile() {
  const speakers = irishSpeakerPopulation();
  const population = populationAgedThreePlus();
  return {speakers, population, share: population > 0 ? speakers / population : 0};
}

const nationalIrishSpeakerProfile = {
  speakers: irishSpeakerPopulation(irishSpeakingFrequency),
  population: d3.sum(constituencyRows, (row) =>
    (Number(row.Total) || 0) -
    (Number(row["Age 0 - Total"]) || 0) -
    (Number(row["Age 1 - Total"]) || 0) -
    (Number(row["Age 2 - Total"]) || 0)
  )
};
nationalIrishSpeakerProfile.share = nationalIrishSpeakerProfile.speakers / nationalIrishSpeakerProfile.population;

function irishFrequencyProfile() {
  const rows = rowsForSelectedArea(irishSpeakingFrequency);
  return IRISH_FREQUENCIES.map((category) => ({
    category: category
      .replace("Speaks Irish ", "")
      .replace("Never speaks Irish outside the education system only", "Never outside education")
      .replace(/^./, (letter) => letter.toUpperCase()),
    total: d3.sum(rows, (row) => Number(row[category]) || 0)
  }));
}

function irishAbilityProfile() {
  const {speakers, population} = irishSpeakerProfile();
  return [
    {category: "Can speak Irish", total: speakers, color: chartPalette[0]},
    {category: "Cannot speak Irish", total: Math.max(0, population - speakers), color: "#d8d1c2"}
  ];
}

function educationDownloadRows() {
  const qualificationByDistrict = new Map(
    educationRowsForScope().map((row) => [row.ED_GUID, row])
  );
  const participationByDistrict = new Map(
    rowsForSelectedArea(educationParticipation).map((row) => [row.ED_GUID, row])
  );
  const irishByDistrict = new Map(
    rowsForSelectedArea(irishSpeakingFrequency).map((row) => [row.ED_GUID, row])
  );

  const percentage = (value, denominator) =>
    denominator > 0 ? Number(((value / denominator) * 100).toFixed(1)) : 0;
  const output = [];
  const append = (district, dataset, sourceTable, category, people, denominator, denominatorDescription) => {
    output.push({
      constituency: district["NEW CONSTITUENCY"],
      electoral_district: district.GEOGDESC,
      electoral_district_id: district.ED_GUID,
      census_year: 2022,
      dataset,
      source_table: sourceTable,
      category,
      people,
      denominator,
      percentage: percentage(people, denominator),
      denominator_description: denominatorDescription
    });
  };

  for (const district of rowsForSelectedArea(constituencyRows)) {
    const qualification = qualificationByDistrict.get(district.ED_GUID);
    const participation = participationByDistrict.get(district.ED_GUID);
    const irish = irishByDistrict.get(district.ED_GUID);

    if (qualification) {
      const denominator = Number(qualification.Total) || 0;
      for (const category of EDUCATION_LEVELS) {
        append(
          district,
          "Highest qualification attained",
          "SAP2022T10T4ED",
          category,
          Number(qualification[category]) || 0,
          denominator,
          "Residents aged 15 and over whose education had ceased"
        );
      }
    }

    if (participation) {
      const population15Plus = Number(participation["Population aged 15 and over"]) || 0;
      for (const category of ["Still at school or college", "Other education not ceased", "Education ceased"]) {
        append(
          district,
          "Education participation",
          "SAP2022T10T2ED",
          category,
          Number(participation[category]) || 0,
          population15Plus,
          "Residents aged 15 and over"
        );
      }

      const ceased = Number(participation["Education ceased"]) || 0;
      for (const category of EDUCATION_CEASED_AGES) {
        append(
          district,
          "Age education ceased",
          "SAP2022T10T1ED",
          category.replace(/^Age /, ""),
          Number(participation[category]) || 0,
          ceased,
          "Residents aged 15 and over whose education had ceased"
        );
      }
    }

    if (irish) {
      const population3Plus = Math.max(
        0,
        (Number(district.Total) || 0) -
        (Number(district["Age 0 - Total"]) || 0) -
        (Number(district["Age 1 - Total"]) || 0) -
        (Number(district["Age 2 - Total"]) || 0)
      );
      const speakers = Number(irish["All Irish speakers"]) || 0;
      append(
        district,
        "Ability to speak Irish",
        "SAP2022T3T2ED",
        "Can speak Irish",
        speakers,
        population3Plus,
        "Residents aged three and over"
      );
      append(
        district,
        "Ability to speak Irish",
        "SAP2022T3T2ED",
        "Cannot speak Irish",
        Math.max(0, population3Plus - speakers),
        population3Plus,
        "Residents aged three and over"
      );
      for (const category of IRISH_FREQUENCIES) {
        append(
          district,
          "Irish-speaking frequency",
          "SAP2022T3T2ED",
          category,
          Number(irish[category]) || 0,
          speakers,
          "Irish speakers aged three and over"
        );
      }
    }
  }

  return output;
}

function differenceText(value) {
  const points = Math.abs(value * 100).toFixed(1);
  if (Math.abs(value) < 0.0005) return "in line with the national figure";
  return `${points} percentage point${points === "1.0" ? "" : "s"} ${value > 0 ? "above" : "below"} the national figure`;
}

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

function constituencyMembers() {
  return membersForConstituency(membersLookup, state.constituency);
}

function recentConstituencyEducationQuestions(limit = 6) {
  const record = recentQuestionsByConstituency.find((entry) => entry.constituency === state.constituency);
  const sorted = (record?.questions ?? [])
    .slice()
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
  const direct = sorted.filter((question) => EDUCATION_HEADING_MATCHER.test(question.heading ?? ""));
  const contextual = sorted.filter((question) => !EDUCATION_HEADING_MATCHER.test(question.heading ?? ""));
  return [...direct, ...contextual].slice(0, limit);
}

function recentConstituencyEducationContributions(limit = 6, perMemberLimit = 3) {
  const memberCodes = new Set(constituencyMembers().map((member) => member.memberCode).filter(Boolean));
  const memberCounts = new Map();
  return recentEducationContributions
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
  window.dispatchEvent(new CustomEvent("education:change"));
  if (preserveScroll) restoreScroll(x, y);
}

function mountReactive(renderFn, options = {}) {
  return createReactiveMount(renderFn, {
    eventName: "education:change",
    ...options
  });
}

function renderScopeControl() {
  const wrap = document.createElement("section");
  wrap.className = "insights-controls education-scope-control";
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

function renderIrishViewControl() {
  const wrap = document.createElement("div");
  wrap.className = "segmented-control-wrap education-irish-control";
  const group = document.createElement("div");
  group.className = "segmented-control";
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", "Irish-language chart view");
  const options = [
    {value: "ability", label: "Ability to speak Irish"},
    {value: "frequency", label: "Speaking frequency"}
  ];
  for (const option of options) {
    const label = document.createElement("label");
    label.className = "segmented-control__option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "education-irish-view";
    input.value = option.value;
    input.checked = state.irishView === option.value;
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.irishView = option.value;
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
  section.className = "demographics-map-explorer education-map-explorer";
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
  window.addEventListener("education:change", update);
  return section;
}
```

```js
const hero = document.createElement("div");
hero.className = "hero education-hero";
hero.innerHTML = `
  <div class="hero__media">
    <video class="hero__video" src="${educationHeroVideo}" autoplay muted loop playsinline aria-hidden="true"></video>
  </div>
  <div class="hero__overlay">
    <div class="hero__content">
      <p class="hero__eyebrow">Constituency insights</p>
      <h1 class="hero__title">Education</h1>
      <p class="hero__subtitle">Explore the education and training  profile of constituencies.</p>
    </div>
  </div>
`;
enhanceHeroWithShare(hero, {title: "Education — Constituency Insights"});
display(hero);
```

```js
display(insightsTabs("education"));
```

<div class="prose-block lead">
  <p>Data from the most recent census indicates the extent to which constituents have pursued education and training to different levels.</p><p>Choose a constituency to explore learning  profiles or see local detail by selecting a district.</p>
</div>

```js
display(renderScopeControl());
```

```js
display(renderDistrictMapExplorer());
```

```js
display(mountReactive(async () => {
  const ranked = educationProfile()
    .filter((d) => d.qualification !== "Not stated")
    .sort((a, b) => d3.descending(a.total, b.total));
  const largest = ranked[0];
  const ceasedTotal = educationPopulation() || 1;
  const note = document.createElement("div");
  note.className = "reactive-prose demographic-story-callout education-scope-note";
  const label = document.createElement("p");
  label.className = "demographic-story-callout__label";
  label.textContent = "At a glance";
  const heading = document.createElement("h2");
  heading.textContent = `${largest?.qualification ?? "Education profile"} is the most common highest qualification in ${scopeLabel()}.`;
  const context = document.createElement("div");
  context.className = "demographic-scope-context";
  const scope = document.createElement("p");
  scope.className = "demographic-scope-context__copy";
  scope.textContent = state.district === "all"
    ? `${state.constituency} contains ${rowsForConstituency().length.toLocaleString("en-IE")} electoral districts in this dataset.`
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
  detail.innerHTML = `<strong>${d3.format(",")(largest?.total ?? 0)}</strong> people reported this level, equivalent to ${d3.format(".1%")((largest?.total ?? 0) / ceasedTotal)} of residents aged 15 and over whose education had ceased.`;
  note.append(label, heading, context, detail);
  return note;
}, {skeleton: "text"}));
```

```js
display(mountReactive(async () => {
  const participation = participationProfile();
  const irish = irishSpeakerProfile();
  const cards = metricCards({metrics: [
    {
      label: "Residents aged 15+ still at school or college",
      value: d3.format(",")(participation.stillAtSchool),
      note: `${d3.format(".1%")(participation.share)} of all residents aged 15+ · ${differenceText(participation.share - nationalParticipation.share)}`
    },
    {
      label: "Irish speakers aged 3+",
      value: d3.format(".1%")(irish.share),
      note: `${d3.format(",")(irish.speakers)} people · ${differenceText(irish.share - nationalIrishSpeakerProfile.share)}`
    }
  ]});
  const wrap = document.createElement("section");
  wrap.className = "insights-metrics-full education-context-metrics";
  wrap.appendChild(cards);
  return wrap;
}, {skeleton: "cards"}));
```

<div class="prose-block prose-block--section">
  <h2>Highest level of education attained</h2>
  <p>Census data indicates the level of education and training achieved, indicated by those who have stopped in their education journey and are 15 or over.</p>
</div>

<div class="chart-block chart-block--wide">

```js
display(mountReactive(async () => educationQualificationWaterfall(educationProfile(), {
  width: 1100,
  title: `Highest level of education completed in ${scopeLabel()}`,
  subtitle: `Census 2022 · both sexes · n = ${d3.format(",")(educationPopulation())}`
})));
```

</div>

<div class="prose-block prose-block--section">
  <h2>Age when education ceased</h2>
  <p>Proportions of the population by age at which formal education ceased, indicated by those aged 15 or over.</p>
</div>

<div class="chart-block chart-block--wide">

```js
display(mountReactive(async () => educationCeasedAgeWaffle(ceasedAgeProfile(), {
  width: 1000,
  title: `Age education ceased in ${scopeLabel()}`,
  subtitle: `Census 2022 · both sexes · n = ${d3.format(",")(participationProfile().ceased)}`
})));
```

</div>

<div class="prose-block prose-block--section">
  <h2>Irish speakers</h2>
  <p>The proportion of residents aged three and over who indicated an ability to speak Irish and how frequently Irish speakers use the language.</p>
</div>

<div class="education-irish-control-block">

```js
display(mountReactive(async () => renderIrishViewControl()));
```

</div>

<div class="chart-block chart-block--wide">

```js
display(mountReactive(async () => {
  const isAbility = state.irishView === "ability";
  const irish = irishSpeakerProfile();
  return irishLanguagePercentageBar(
    isAbility ? irishAbilityProfile() : irishFrequencyProfile(),
    {
      width: 1000,
      title: isAbility
        ? `Ability to speak Irish in ${scopeLabel()}`
        : `How often Irish speakers in ${scopeLabel()} speak Irish`,
      subtitle: isAbility
        ? `Population aged three and over · Census 2022 · n = ${d3.format(",")(irish.population)}`
        : `Irish speakers aged three and over · Census 2022 · n = ${d3.format(",")(irish.speakers)}`,
      itemLabel: isAbility ? "residents" : "Irish speakers",
      shareLabel: isAbility
        ? "of all residents aged three and over"
        : "of Irish speakers aged three and over",
      note: isAbility
        ? "Each stripe represents approximately 1% of all residents aged three and over in the selected area."
        : "Each stripe represents approximately 1% of Irish speakers aged three and over in the selected area."
    }
  );
}));
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
}), {skeleton: "cards"}));
```

<div class="prose-block">
  <h2>Recent parliamentary questions related to education</h2>
  <p>Read recent parliamentary questions tabled by ${state.constituency} TDs related to education.</p>
</div>

<div class="chart-block">

```js
display(mountReactive(async () => parliamentaryQuestionList({
  rows: recentConstituencyEducationQuestions(6),
  members: constituencyMembers(),
  partyColorMap,
  emptyMessage: "No recent education-related parliamentary questions are available for this constituency."
}), {skeleton: "table"}));
```

</div>

<div class="prose-block">
  <h2>Recent speeches related to education and learning.</h2>
  <p>Read recent contributions in Dáil Éireann by the TDs who represent ${state.constituency}.</p>
</div>

<div class="chart-block">

```js
display(mountReactive(async () => memberContributionList({
  rows: recentConstituencyEducationContributions(6),
  members: constituencyMembers(),
  partyColorMap,
  emptyMessage: "No recent education-related Dáil contributions are available for this constituency."
}), {skeleton: "table"}));
```

</div>

<div class="prose-block prose-block--section">
  <h2>Explore our research</h2>
  <p>Our research and analysis takes a deep dive into education and related topics.</p>
</div>

<div class="chart-block">

```js
display(relatedResearchResource({
  rows: [
    {
      date: "2026-03-26",
      author: "Committee on Education and Youth",
      authorUrl: "https://www.oireachtas.ie/en/committees/34/education-and-youth/",
      title: "Report on Evaluating the Impacts of the School Meals Programme",
      url: "https://data.oireachtas.ie/ie/oireachtas/caighdeanOifigiul/2026/2026-03-26_report-on-evaluating-the-impacts-of-the-school-meals-programme_en.pdf"
    },
    {
    date: "2025-10-13",
    author: "L&RS",
    authorUrl: "https://www.oireachtas.ie/en/how-parliament-is-run/houses-of-the-oireachtas-service/library-and-research-service/",
    title: "Briefing: National Training Fund (Amendment) Bill 2025",
    url: "https://data.oireachtas.ie/ie/oireachtas/libraryResearch/2025/2025-11-03_bill-digest-national-training-fund-amendment-bill-2025_en.pdf"
  },
  {
    date: "2025-06-19",
    author: "PBO",
    authorUrl: "https://www.oireachtas.ie/pbo",
    title: "Overview of the School Transport Scheme",
    url: "https://app.powerbi.com/view?r=eyJrIjoiNDY1MmRhNjUtZDdkZC00NmU2LWFhNWYtYzFhODcyNTRhY2RkIiwidCI6ImNlNzFlY2YwLTBiOTctNDdiMi05NjZjLWI0ZWNjOGRiMjNmMiIsImMiOjl9"
  },]
}));
```

</div>

<div class="prose-block demographics-source-note">
  <h2>About the data</h2>
  <p>Data collected for <a href="https://www.cso.ie/en/statistics/population/censusofpopulation2022/censusofpopulation2022-summaryresults/" target="_blank" rel="noreferrer">Census 2022</a> by the CSO underpins Constituency Insights.</p>
  <p>Highest qualification counts are from Census 2022 table SAP2022T10T4ED. Continued education and age education ceased figures are from tables SAP2022T10T2ED and SAP2022T10T1ED. These measures describe residents aged 15 and over and use the combined count for both sexes. Irish language figures are from table SAP2022T3T2ED and describe Irish speakers aged three and over; the denominator for the speaker share is calculated from single-year census age counts so children aged under three are excluded.</p><p>View datasets for <a href="https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/SAP2022T10T4ED/JSON-stat/2.0/en" target="_blank" rel="noreferrer">qualifications</a>, <a href="https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/SAP2022T10T2ED/JSON-stat/2.0/en" target="_blank" rel="noreferrer">continued education</a>, <a href="https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/SAP2022T10T1ED/JSON-stat/2.0/en" target="_blank" rel="noreferrer">age education ceased</a> or <a href="https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/SAP2022T3T2ED/JSON-stat/2.0/en" target="_blank" rel="noreferrer">Irish-speaking frequency</a>.</p>
</div>

```js
display(mountReactive(async () => {
  const wrap = document.createElement("div");
  wrap.className = "download-block";
  wrap.appendChild(downloadButton(
    educationDownloadRows(),
    `${scopeLabel().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-education-2022.csv`,
    {label: `Download education data for ${scopeLabel()}`}
  ));
  return wrap;
}, {skeleton: "text"}));
```
