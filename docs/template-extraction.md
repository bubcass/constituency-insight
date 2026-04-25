# Constituency Insights Template Extraction

This note turns the current Sports Funding page into a concrete plan for a reusable Observable Framework template. The aim is a starter repo where someone can replace data, write a new `src/index.md`, add topic-specific transforms or charts, and keep the shared Constituency Insights styling and civic components.

## Target Repo Shape

```text
constituency-insights-template/
  observablehq.config.js
  package.json
  README.md
  docs/
    data-contracts.md
    creating-a-new-page.md
    template-extraction.md
  src/
    index.md
    style.css
    styles/
      base.css
      theme.css
    components/
      constituency-select.js
      constituency-map.js
      topic-point-map.js
      member-cards.js
      metric-cards.js
      download-button.js
      charts/
    data/
      sample/
      geo/
      derived/
      transformers/
    topics/
      sample-topic/
        config.js
        transforms.js
    media/
```

The template should stay opinionated: one polished civic page layout, one constituency selection model, one map pattern, one member-card pattern, and clear extension points for new topics.

## Current File Classification

| Path | Template role | Notes |
| --- | --- | --- |
| `observablehq.config.js` | Shared template | Keep root/style/theme/page settings. Convert the title and footer into easy template settings. |
| `package.json` | Shared template | Keep Observable, D3, Turf, deploy scripts, and build conventions. Topic-specific build scripts should become examples or documented extension scripts. |
| `README.md` | Rewrite for template | Replace the stock Observable text with a getting-started path for replacing data and creating a topic. |
| `src/style.css` | Shared template | Keep as the single style entry point. |
| `src/styles/base.css` | Shared template | Keep if it contains layout/reset primitives. This file is currently untracked, so review before moving it into the template. |
| `src/styles/theme.css` | Shared template | Keep as the main visual identity. This file has local edits, so preserve the current worktree changes. |
| `src/components/constituency-select.js` | Shared component | General enough to keep. Document expected option shape and state object. |
| `src/components/member-cards.js` | Shared component | Keep. Document the member record contract. |
| `src/components/metric-cards.js` | Shared component | Keep. Already accepts generic metric objects. |
| `src/components/download-button.js` | Shared component | Keep. Document expected rows and file naming hook. |
| `src/components/constituency-map.js` | Shared component or optional map | Keep if the template wants a boundary-only map. It imports Leaflet, so add `leaflet` to dependencies if this remains in the template. |
| `src/components/topic-point-map.js` | Shared component | Keep as the reusable point-on-constituency map. Document field mappings, tooltip hook, and palette expectations. |
| `src/components/waterfall-segments-chart.js` | Example chart | Move under `src/components/charts/` or make it part of the sports funding example. |
| `src/components/election-controls.js` | Candidate shared component | Keep only if a second topic needs it; otherwise move to sample/example code. |
| `src/topics/sports-funding/config.js` | Topic example | Use as the model for a topic config contract. Rename to `sample-topic/config.js` in the template. |
| `src/topics/sports-funding/transforms.js` | Topic example | Use as the model for topic transforms. Some helpers can be generalized later. |
| `src/index.md` | Reference implementation | Split into shared page helpers and a shorter sample `index.md`. The current file mixes data loading, state, helper functions, page copy, and rendering. |
| `src/data/data_sports_funding.csv` | Sample data | Keep a reduced or anonymised sample if appropriate. Otherwise document the expected input columns and omit the full data from the template. |
| `src/data/election_2024_cleaned.csv` | Project-specific data | Keep only if member lookup or election context is part of the template. |
| `src/data/members-lookup.json` | Shared sample/reference data | Keep as sample data or replace with a smaller fixture. Document member fields. |
| `src/data/geo/constituencies.json` | Shared base data | Keep if the template is Ireland-specific; otherwise make this a sample and document how to replace boundaries. |
| `src/data/derived/*.json` | Generated outputs | Keep small generated fixtures for the sample page, but document rebuild commands. Avoid making large derived files the only source of truth. |
| `src/data/transformers/*.js` | Topic loaders/transformers | Keep as examples. Make naming consistent and explain input/output contracts. |
| `src/scripts/build-pq-sports-links.mjs` | Project-specific script | Keep only in the Sports Funding example or remove from the generic template. |
| `src/media/sports-funding-hero.mp4` | Sample asset | Replace with a small default asset or document how to replace. |
| `src/media/election.mp4`, `src/media/bound-volume.jpeg` | Project/sample assets | Keep only if used by the sample page; otherwise remove from the template. |

## First Data Contracts

### Constituency Boundary

Components that render or detect constituencies expect a GeoJSON `FeatureCollection`.

Required feature fields:

| Field | Description |
| --- | --- |
| `geometry` | Polygon or MultiPolygon boundary. |
| `properties.ENG_NAME_VALUE` | Display name used by the current Ireland-specific matchers. |

Template improvement: allow the property name to be configured, for example `constituencyNameField: "ENG_NAME_VALUE"`, instead of hard-coding it in `src/index.md` and `src/components/constituency-map.js`.

### Topic Rows

The current page normalises raw sports funding records into internal fields with `__` prefixes. Reusable visual components depend on those internal fields rather than raw column names.

Required fields for the current topic map and metrics:

| Field | Description |
| --- | --- |
| `__constituency` | Constituency display name. |
| `__constituencySlug` | Stable slug for joins and URLs. |
| `__lat` | Latitude for point maps. |
| `__lon` | Longitude for point maps. |
| `__amount` | Numeric value used for map scaling, metrics, charts, and downloads. |
| `__category` | Category or type used for layer toggles and legends. |
| `__year` | Year or period label. |
| `__entity` | Organisation, person, or body associated with the record. |
| `__title` | Human-readable item title. |
| `__county` | Optional county or region label. |

Template improvement: publish this as the canonical topic-row contract, then let each topic transformer map raw columns into these fields.

### Member Records

`src/components/member-cards.js` expects records shaped like this:

| Field | Required | Description |
| --- | --- | --- |
| `displayName` or `memberName` | Yes | Name shown on the card. |
| `party` or `matchedParty` | Recommended | Party label and color lookup key. |
| `imageUrl` | Optional | Image URL. A placeholder initial is shown when absent. |
| `memberUrl` | Optional | External profile link. |
| `constituency` | Recommended | Used before rendering to match members to the selected constituency. |
| `memberCode` | Optional | Current Oireachtas image lookup input. |

Template improvement: move Oireachtas-specific image URL derivation out of `src/index.md` and into either a sample adapter or an optional helper.

### Topic Config

`src/topics/sports-funding/config.js` is the best starting contract for new topics.

Required sections:

| Key | Description |
| --- | --- |
| `slug`, `title`, `eyebrow`, `heroTitle`, `heroSubtitle` | Page identity and hero copy. |
| `palette` | Category color sequence for maps/charts. |
| `fields` | Raw-to-normalised field mapping or documentation of expected raw fields. |
| `labels` | UI labels and label functions. |
| `metrics` | Metric-card definitions. |
| `formatters` | Value formatters, especially amount/value display. |
| `tooltipHTML` | Topic-specific map tooltip renderer. |

## Extraction Sequence

1. Create a small template branch or new repo from the current app.
2. Preserve the current Sports Funding app as the reference implementation.
3. Move reusable page helper functions out of `src/index.md` into `src/components` or `src/lib`.
4. Rename `src/topics/sports-funding` to `src/topics/sample-topic` in the template and reduce the dataset to a lightweight fixture.
5. Create `docs/data-contracts.md` from the contracts above.
6. Rewrite `README.md` around the golden path: install, run, replace data, edit `src/index.md`, add a topic config, build, publish.
7. Add a validation script that checks required fields in the normalised topic rows, member records, and constituency GeoJSON.
8. Build a second page from the template without changing shared components. Use that as the proof that the boundary between shared and topic-specific code is right.

## Recommended Refactors Before Templating

- Add a `src/lib/constituency.js` module for cleaning names, selecting defaults, filtering GeoJSON, and optional geolocation detection.
- Add a `src/lib/reactive.js` module for `mountReactive` and shared event names.
- Add a `src/lib/format.js` module for currency, dates, integers, and HTML escaping.
- Parameterise hard-coded Ireland/Oireachtas assumptions: constituency name property, locale, currency, member image URL construction, party color map, and footer text.
- Move `partyColorMap` into a configurable module or topic/site config.
- Decide whether Leaflet is a first-class dependency. If `constituency-map.js` remains in the template, add `leaflet` explicitly to `package.json`.
- Keep the `__field` normalisation convention, but document it clearly so custom loaders can target it.

## Open Decisions

- Should the first template be Ireland/Oireachtas-specific, or a more general constituency/civic-insights starter?
- Should sample data be full enough to demonstrate the page, or intentionally tiny so the repo is easier to inspect?
- Should generated `src/data/derived/*.json` files be committed, or should users always rebuild them from raw data?
- Should the template support one topic per repo, multiple topics in one repo, or both?
- Should publish target remain `gh-pages`, or should the template document GitHub Pages, Observable deploy, and static hosting separately?

## Definition of Done for the Template

- A new user can run `npm install` and `npm run dev` and see a working sample page.
- The README tells them exactly which files to replace first.
- `docs/data-contracts.md` defines the data shapes consumed by shared components.
- The sample `src/index.md` is short enough to read without understanding every helper.
- A custom topic can be added by editing topic config, topic transforms, and data files without rewriting shared components.
- Validation catches missing constituency names, invalid coordinates, missing member names, and malformed GeoJSON before build/publish.
