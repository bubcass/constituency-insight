# Elections Explorer

## Transport access

Run `npm run build:transport-access` to refresh the bus-stop, rail-station,
Luas-stop and rail-network snapshot used on the transport page. The build reads the NTA NaPTAN feed and
Tailte Éireann's Rail Network Segment feature service, assigns features to the
site's electoral-district and constituency geography, and writes
`src/data/derived/transport-access.json`.

## Recent parliamentary activity

Run `npm run build:parliamentary` to refresh the sitting-member lookup,
contributions and every question feed in one pass. `npm run build` then packages
those generated snapshots into the static site; it does not fetch parliamentary
data itself.

Run `npm run build:recent-contributions` to fetch recent Dáil
debates from the Oireachtas API and rebuild
`src/data/derived/recent-member-contributions.json`. Records are grouped by
member and debate section and link to the Oireachtas `member-speech` page.
The generated browser resource retains the 12 newest sections per member to
keep the page payload compact.
The same run also writes `recent-sports-contributions.json`, filtering the full
120-day extraction for headings containing “sport” or “sports” before applying
the per-member limit. This keeps topic pages complete without enlarging the
general browser resource.

Run `npm run build:recent-questions` to fetch PQ Explorer's committed annual
constituency datasets from `bubcass/pq-explorer`. One run rebuilds the general,
sports, work, housing, transport and education question feeds from that shared
source. Questions are limited to Deputies marked as sitting in
`src/data/members-lookup.json`. New topic pages should add their matcher and
output to `TOPICS` in `src/scripts/build-recent-questions.mjs` rather than
introducing a separate question source.

The `Update recent parliamentary activity` GitHub Actions workflow runs both
refreshes each night, commits the datasets only when their contents change and
thereby triggers a new GitHub Pages deployment. A manual contributions date
range can be built with:

```bash
node src/scripts/build-recent-contributions.mjs \
  --date-start 2026-07-01 \
  --date-end 2026-07-17
```

For local question-pipeline development, a PQ Explorer checkout can be used
without downloading its GitHub snapshots:

```bash
npm run build:recent-questions -- \
  --source-dir /path/to/pq-explorer/src/data/pq
```

## Chart palettes

Categorical charts and topic maps use the shared palette selected by
`chartPaletteName` in `src/config/chart-palette.js`. Set it to one of:

- `"default"` — the existing Constituency Insights palette
- `"muted"` — a lower-saturation version of the default palette
- `"lrs"` — the L&RS/PRS palette
- `"pbo"` — the PBO brand palette

Changing that single value applies the selection site-wide. For a deliberate
one-chart exception, import `getChartPalette` or pass a palette name as the
second argument to `categoryColorMap`. Meaning-bearing colours such as party
identity and road-collision severity are kept separate from categorical chart
palettes.

This is an [Observable Framework](https://observablehq.com/framework/) app. To install the required dependencies, run:

```
npm install
```

Then, to start the local preview server, run:

```
npm run dev
```

Then visit <http://localhost:3000> to preview your app.

For more, see <https://observablehq.com/framework/getting-started>.

## Project structure

A typical Framework project looks like this:

```ini
.
├─ src
│  ├─ components
│  │  └─ timeline.js           # an importable module
│  ├─ data
│  │  ├─ launches.csv.js       # a data loader
│  │  └─ events.json           # a static data file
│  ├─ example-dashboard.md     # a page
│  ├─ example-report.md        # another page
│  └─ index.md                 # the home page
├─ .gitignore
├─ observablehq.config.js      # the app config file
├─ package.json
└─ README.md
```

**`src`** - This is the “source root” — where your source files live. Pages go here. Each page is a Markdown file. Observable Framework uses [file-based routing](https://observablehq.com/framework/project-structure#routing), which means that the name of the file controls where the page is served. You can create as many pages as you like. Use folders to organize your pages.

**`src/index.md`** - This is the home page for your app. You can have as many additional pages as you’d like, but you should always have a home page, too.

**`src/data`** - You can put [data loaders](https://observablehq.com/framework/data-loaders) or static data files anywhere in your source root, but we recommend putting them here.

**`src/components`** - You can put shared [JavaScript modules](https://observablehq.com/framework/imports) anywhere in your source root, but we recommend putting them here. This helps you pull code out of Markdown files and into JavaScript modules, making it easier to reuse code across pages, write tests and run linters, and even share code with vanilla web applications.

**`observablehq.config.js`** - This is the [app configuration](https://observablehq.com/framework/config) file, such as the pages and sections in the sidebar navigation, and the app’s title.

## Command reference

| Command           | Description                                              |
| ----------------- | -------------------------------------------------------- |
| `npm install`            | Install or reinstall dependencies                        |
| `npm run dev`        | Start local preview server                               |
| `npm run build`      | Build your static site, generating `./dist`              |
| `npm run deploy`     | Deploy your app to Observable                            |
| `npm run clean`      | Clear the local data loader cache                        |
| `npm run observable` | Run commands like `observable help`                      |
