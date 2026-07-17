/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/polygon-to-line@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{featureCollection as r,multiLineString as e,lineString as t}from"../helpers@7.3.4/a5e57fe3.js";import{getGeom as o}from"../invariant@7.3.4/0f53e08e.js";function p(r,e={}){const t=o(r);switch(e.properties||"Feature"!==r.type||(e.properties=r.properties),t.type){case"Polygon":return n(t,e);case"MultiPolygon":return i(t,e);default:throw new Error("invalid poly")}}function n(r,e={}){return s(o(r).coordinates,e.properties?e.properties:"Feature"===r.type?r.properties:{})}function i(e,t={}){const p=o(e).coordinates,n=t.properties?t.properties:"Feature"===e.type?e.properties:{},i=[];return p.forEach((r=>{i.push(s(r,n))})),r(i)}function s(r,o){return r.length>1?e(r,o):t(r[0],o)}var u=p;export{s as coordsToLine,u as default,i as multiPolygonToLine,p as polygonToLine,n as singlePolygonToLine};
