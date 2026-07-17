/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/angle@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{bearing as r}from"../bearing@7.3.4/2c3cb3af.js";import{isObject as e,bearingToAzimuth as t}from"../helpers@7.3.4/a5e57fe3.js";import{rhumbBearing as o}from"../rhumb-bearing@7.3.4/b4be7393.js";function i(i,n,m,s={}){if(!e(s))throw new Error("options is invalid");if(!i)throw new Error("startPoint is required");if(!n)throw new Error("midPoint is required");if(!m)throw new Error("endPoint is required");const f=i,a=n,p=m,u=t(!0!==s.mercator?r(a,f):o(a,f));let w=t(!0!==s.mercator?r(a,p):o(a,p));w<u&&(w+=360);const d=w-u;return!0===s.explementary?360-d:d}var n=i;export{i as angle,n as default};
