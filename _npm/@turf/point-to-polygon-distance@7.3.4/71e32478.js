/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/point-to-polygon-distance@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{booleanPointInPolygon as t}from"../boolean-point-in-polygon@7.3.4/f12a8f4c.js";import{pointToLineDistance as o}from"../point-to-line-distance@7.3.4/9468cd88.js";import{polygonToLine as n}from"../polygon-to-line@7.3.4/0407b4f2.js";import{getGeom as r}from"../invariant@7.3.4/0f53e08e.js";import{flattenEach as e}from"../meta@7.3.4/1244e006.js";import{polygon as i}from"../helpers@7.3.4/a5e57fe3.js";function m(s,p,a={}){var u,f;const l=null!=(u=a.method)?u:"geodesic",h=null!=(f=a.units)?f:"kilometers";if(!s)throw new Error("point is required");if(!p)throw new Error("polygon or multi-polygon is required");const c=r(p);if("MultiPolygon"===c.type){const o=c.coordinates.map((t=>m(s,i(t),{method:l,units:h})));return Math.min(...o.map(Math.abs))*(t(s,p)?-1:1)}if(c.coordinates.length>1){const[t,...o]=c.coordinates.map((t=>m(s,i([t]),{method:l,units:h})));if(t>=0)return t;const n=Math.min(...o);return n<0?Math.abs(n):Math.max(-1*n,t)}const d=n(c);let g=1/0;return e(d,(t=>{g=Math.min(g,o(s,t,{method:l,units:h}))})),t(s,c)?-g:g}var s=m;export{s as default,m as pointToPolygonDistance};
