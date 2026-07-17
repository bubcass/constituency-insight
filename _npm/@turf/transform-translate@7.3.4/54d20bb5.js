/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/transform-translate@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{coordEach as r}from"../meta@7.3.4/1244e006.js";import{isObject as i}from"../helpers@7.3.4/a5e57fe3.js";import{getCoords as n}from"../invariant@7.3.4/0f53e08e.js";import{clone as t}from"../clone@7.3.4/9edb039d.js";import{rhumbDestination as o}from"../rhumb-destination@7.3.4/29240aa5.js";function e(e,m,s,u){if(!i(u=u||{}))throw new Error("options is invalid");var a=u.units,f=u.zTranslation,p=u.mutate;if(!e)throw new Error("geojson is required");if(null==m||isNaN(m))throw new Error("distance is required");if(f&&"number"!=typeof f&&isNaN(f))throw new Error("zTranslation is not a number");if(f=void 0!==f?f:0,0===m&&0===f)return e;if(null==s||isNaN(s))throw new Error("direction is required");return m<0&&(m=-m,s+=180),!1!==p&&void 0!==p||(e=t(e)),r(e,(function(r){var i=n(o(r,m,s,{units:a}));r[0]=i[0],r[1]=i[1],f&&3===r.length&&(r[2]+=f)})),e}var m=e;export{m as default,e as transformTranslate};
