/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/explode@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{featureEach as t,coordEach as e}from"../meta@7.3.4/1244e006.js";import{point as r,featureCollection as n}from"../helpers@7.3.4/a5e57fe3.js";function o(o){const p=[];return"FeatureCollection"===o.type?t(o,(function(t){e(t,(function(e){p.push(r(e,t.properties))}))})):"Feature"===o.type?e(o,(function(t){p.push(r(t,o.properties))})):e(o,(function(t){p.push(r(t))})),n(p)}var p=o;export{p as default,o as explode};
