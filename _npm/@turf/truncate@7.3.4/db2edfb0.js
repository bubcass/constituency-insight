/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/truncate@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{coordEach as r}from"../meta@7.3.4/1244e006.js";import{isObject as e}from"../helpers@7.3.4/a5e57fe3.js";function n(n,o){if(!e(o=null!=o?o:{}))throw new Error("options is invalid");var t=o.precision,i=o.coordinates,s=o.mutate;if(t=null==t||isNaN(t)?6:t,i=null==i||isNaN(i)?3:i,!n)throw new Error("<geojson> is required");if("number"!=typeof t)throw new Error("<precision> must be a number");if("number"!=typeof i)throw new Error("<coordinates> must be a number");!1!==s&&void 0!==s||(n=JSON.parse(JSON.stringify(n)));var u=Math.pow(10,t);return r(n,(function(r){!function(r,e,n){r.length>n&&r.splice(n,r.length);for(var o=0;o<r.length;o++)r[o]=Math.round(r[o]*e)/e}(r,u,i)})),n}var o=n;export{o as default,n as truncate};
