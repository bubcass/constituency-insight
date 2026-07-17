/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/transform-rotate@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{centroid as r}from"../centroid@7.3.4/b840a8be.js";import{rhumbBearing as t}from"../rhumb-bearing@7.3.4/b4be7393.js";import{rhumbDistance as m}from"../rhumb-distance@7.3.4/b9e69516.js";import{rhumbDestination as o}from"../rhumb-destination@7.3.4/29240aa5.js";import{clone as n}from"../clone@7.3.4/9edb039d.js";import{coordEach as i}from"../meta@7.3.4/1244e006.js";import{getCoords as e}from"../invariant@7.3.4/0f53e08e.js";import{isObject as f}from"../helpers@7.3.4/a5e57fe3.js";function s(s,u,p){if(!f(p=p||{}))throw new Error("options is invalid");const a=p.pivot,l=p.mutate;if(!s)throw new Error("geojson is required");if(null==u||isNaN(u))throw new Error("angle is required");if(0===u)return s;const c=null!=a?a:r(s);return!1!==l&&void 0!==l||(s=n(s)),i(s,(function(r){const n=t(c,r)+u,i=m(c,r),f=e(o(c,i,n));r[0]=f[0],r[1]=f[1]})),s}var u=s;export{u as default,s as transformRotate};
