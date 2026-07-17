/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/flip@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{coordEach as r}from"../meta@7.3.4/1244e006.js";import{isObject as o}from"../helpers@7.3.4/a5e57fe3.js";import{clone as t}from"../clone@7.3.4/9edb039d.js";function e(e,n){var i;if(!o(n=n||{}))throw new Error("options is invalid");const m=null!=(i=n.mutate)&&i;if(!e)throw new Error("geojson is required");return!1!==m&&void 0!==m||(e=t(e)),r(e,(function(r){var o=r[0],t=r[1];r[0]=t,r[1]=o})),e}var n=e;export{n as default,e as flip};
