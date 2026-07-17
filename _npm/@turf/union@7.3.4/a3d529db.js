/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/union@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import*as e from"../../polyclip-ts@0.16.8/c7396230.js";import{polygon as t,multiPolygon as r}from"../helpers@7.3.4/a5e57fe3.js";import{geomEach as o}from"../meta@7.3.4/1244e006.js";function n(n,s={}){const p=[];if(o(n,(e=>{p.push(e.coordinates)})),p.length<2)throw new Error("Must have at least 2 geometries");const m=e.union(p[0],...p.slice(1));return 0===m.length?null:1===m.length?t(m[0],s.properties):r(m,s.properties)}var s=n;export{s as default,n as union};
