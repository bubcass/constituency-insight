/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/sector@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{circle as r}from"../circle@7.3.4/8fa375c0.js";import{lineArc as e}from"../line-arc@7.3.4/1eaa469e.js";import{coordEach as t}from"../meta@7.3.4/1244e006.js";import{isObject as i,polygon as o}from"../helpers@7.3.4/a5e57fe3.js";import{getCoords as n}from"../invariant@7.3.4/0f53e08e.js";function f(f,u,s,p,a={}){if(!i(a=a||{}))throw new Error("options is invalid");const w=a.properties;if(!f)throw new Error("center is required");if(null==s)throw new Error("bearing1 is required");if(null==p)throw new Error("bearing2 is required");if(!u)throw new Error("radius is required");if("object"!=typeof a)throw new Error("options must be an object");if(m(s)===m(p))return r(f,u,a);const c=n(f),l=e(f,u,s,p,a),h=[[c]];return t(l,(function(r){h[0].push(r)})),h[0].push(c),o(h,w)}function m(r){let e=r%360;return e<0&&(e+=360),e}var u=f;export{u as default,f as sector};
