/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/line-slice@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{getCoords as e,getType as t}from"../invariant@7.3.4/0f53e08e.js";import{lineString as r}from"../helpers@7.3.4/a5e57fe3.js";import{nearestPointOnLine as n}from"../nearest-point-on-line@7.3.4/f3d65758.js";function o(o,p,i){const m=e(i);if("LineString"!==t(i))throw new Error("line must be a LineString");const a=n(i,o),g=n(i,p);s(i,a),s(i,g);const u=a.properties.segmentIndex<=g.properties.segmentIndex?[a,g]:[g,a],d=[u[0].geometry.coordinates];for(let e=u[0].properties.segmentIndex+1;e<u[1].properties.segmentIndex+1;e++)d.push(m[e]);return d.push(u[1].geometry.coordinates),r(d,"Feature"===i.type?i.properties:{})}function s(e,t){let r="Feature"===e.type?e.geometry:e;t.properties.segmentIndex>=r.coordinates.length-1&&(t.properties.segmentIndex=r.coordinates.length-2)}var p=o;export{p as default,o as lineSlice};
