/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/great-circle@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{lineString as r}from"../helpers@7.3.4/a5e57fe3.js";import{getCoord as o}from"../invariant@7.3.4/0f53e08e.js";import{GreatCircle as t}from"../../arc@0.2.0/60c20533.js";function n(n,e,f={}){if("object"!=typeof f)throw new Error("options is invalid");const{properties:i={},npoints:s=100,offset:p=10}=f,m=o(n),a=o(e);if(m[0]===a[0]&&m[1]===a[1]){const o=Array(s).fill([m[0],m[1]]);return r(o,i)}return new t({x:m[0],y:m[1]},{x:a[0],y:a[1]},i||{}).Arc(s,{offset:p}).json()}var e=n;export{e as default,n as greatCircle};
