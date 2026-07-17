/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/mask@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{multiPolygon as e,polygon as t}from"../helpers@7.3.4/a5e57fe3.js";import*as o from"../../polyclip-ts@0.16.8/c7396230.js";import{clone as r}from"../clone@7.3.4/9edb039d.js";function n(e,t,n){var i;const s=null!=(i=null==n?void 0:n.mutate)&&i;let m=t;t&&!1===s&&(m=r(t));const c=a(m);let l=null;var p;return l="FeatureCollection"===e.type?u(2===(p=e).features.length?o.union(p.features[0].geometry.coordinates,p.features[1].geometry.coordinates):o.union.apply(o,p.features.map((function(e){return e.geometry.coordinates})))):"Feature"===e.type?u(o.union(e.geometry.coordinates)):u(o.union(e.coordinates)),l.geometry.coordinates.forEach((function(e){c.geometry.coordinates.push(e[0])})),c}function u(t){return e(t)}function a(e){let o=[[[180,90],[-180,90],[-180,-90],[180,-90],[180,90]]];return e&&(o="Feature"===e.type?e.geometry.coordinates:e.coordinates),t(o)}var i=n;export{i as default,n as mask};
