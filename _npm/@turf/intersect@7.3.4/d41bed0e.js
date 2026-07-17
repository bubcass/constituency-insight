/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/intersect@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{polygon as e,multiPolygon as t}from"../helpers@7.3.4/a5e57fe3.js";import{geomEach as r}from"../meta@7.3.4/1244e006.js";import*as o from"../../polyclip-ts@0.16.8/c7396230.js";function s(s,n={}){const p=[];if(r(s,(e=>{p.push(e.coordinates)})),p.length<2)throw new Error("Must specify at least 2 geometries");const i=o.intersection(p[0],...p.slice(1));return 0===i.length?null:1===i.length?e(i[0],n.properties):t(i,n.properties)}var n=s;export{n as default,s as intersect};
