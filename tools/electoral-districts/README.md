# Electoral-district boundary maintenance

This is an isolated maintenance tool for regenerating
`src/data/geo/electoral-districts-2022.geojson`. The generated file is a
verified, versioned input to Constituency Insights; the website does not need
mapshaper to install, refresh its other data or build.

Do not run this tool as part of routine builds. Use it only when the official
CSO electoral-district geometry changes or the simplification settings are
deliberately revised.

The geometry validator shares Turf with the application, so first install the
normal application dependencies. Then install the separate mapshaper tool. From
the repository root:

```bash
npm ci
npm --prefix tools/electoral-districts ci
npm --prefix tools/electoral-districts run build
```

The default source is the official 20 m CSO ArcGIS layer. The build expects
exactly 3,420 unique 2022 electoral districts, simplifies them with weighted
6% retention and `keep-shapes`, substitutes the small set of reviewed fallback
geometries where required, validates every feature, and then replaces the
versioned GeoJSON.

Optional source/simplification settings can be passed after `--`:

```bash
npm --prefix tools/electoral-districts run build -- --resolution=50 --retain=8
```

Mapshaper includes readers for formats this process does not use, and some of
those transitive packages currently have published security advisories. Keep
this tool out of website build and deployment environments. Run it without
application or deployment secrets, and only against the fixed official CSO
GeoJSON service; do not use it to process uploaded or otherwise untrusted
files.

Before accepting a regenerated file, review its diff and visually test all map
pages. A routine run should never be assumed safe merely because validation
passes. Keep the existing versioned file unless a boundary update is intended.
