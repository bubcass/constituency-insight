/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/difference@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import*as e from"../../polyclip-ts@0.16.8/c7396230.js";import{polygon as t,multiPolygon as r}from"../helpers@7.3.4/a5e57fe3.js";import{geomEach as s}from"../meta@7.3.4/1244e006.js";function o(o){const n=[];if(s(o,(e=>{n.push(e.coordinates)})),n.length<2)throw new Error("Must have at least two features");const f=o.features[0].properties||{},m=e.difference(n[0],...n.slice(1));return 0===m.length?null:1===m.length?t(m[0],f):r(m,f)}var n=o;export{n as default,o as difference};
