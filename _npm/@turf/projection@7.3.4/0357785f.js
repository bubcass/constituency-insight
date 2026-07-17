/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/projection@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{coordEach as r}from"../meta@7.3.4/1244e006.js";import{isNumber as t}from"../helpers@7.3.4/a5e57fe3.js";import{clone as n}from"../clone@7.3.4/9edb039d.js";function a(r,t={}){return o(r,"mercator",t)}function e(r,t={}){return o(r,"wgs84",t)}function o(a,e,o={}){var f=(o=o||{}).mutate;if(!a)throw new Error("geojson is required");return Array.isArray(a)&&t(a[0])?a="mercator"===e?u(a):m(a):(!0!==f&&(a=n(a)),r(a,(function(r){var t="mercator"===e?u(r):m(r);r[0]=t[0],r[1]=t[1]}))),a}function u(r){var t,n=Math.PI/180,a=6378137,e=20037508.342789244,o=[a*(Math.abs(r[0])<=180?r[0]:r[0]-360*((t=r[0])<0?-1:t>0?1:0))*n,a*Math.log(Math.tan(.25*Math.PI+.5*r[1]*n))];return o[0]>e&&(o[0]=e),o[0]<-e&&(o[0]=-e),o[1]>e&&(o[1]=e),o[1]<-e&&(o[1]=-e),o}function m(r){var t=180/Math.PI,n=6378137;return[r[0]*t/n,(.5*Math.PI-2*Math.atan(Math.exp(-r[1]/n)))*t]}export{a as toMercator,e as toWgs84};export default null;
