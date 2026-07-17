/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/points-within-polygon@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{booleanPointInPolygon as t}from"../boolean-point-in-polygon@7.3.4/f12a8f4c.js";import{multiPoint as o,featureCollection as e}from"../helpers@7.3.4/a5e57fe3.js";import{featureEach as n,geomEach as r,coordEach as i}from"../meta@7.3.4/1244e006.js";function p(p,m){const u=[];return n(p,(function(e){let n=!1;if("Point"===e.geometry.type)r(m,(function(o){t(e,o)&&(n=!0)})),n&&u.push(e);else{if("MultiPoint"!==e.geometry.type)throw new Error("Input geometry must be a Point or MultiPoint");var p=[];r(m,(function(o){i(e,(function(e){t(e,o)&&(n=!0,p.push(e))}))})),n&&u.push(o(p,e.properties))}})),e(u)}var m=p;export{m as default,p as pointsWithinPolygon};
