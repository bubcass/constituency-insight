/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/convex@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{polygon as n}from"../helpers@7.3.4/a5e57fe3.js";import{coordEach as t}from"../meta@7.3.4/1244e006.js";import r from"../../concaveman@1.2.1/bab7a7b0.js";function m(m,o={}){o.concavity=o.concavity||1/0;const e=[];if(t(m,(n=>{e.push([n[0],n[1]])})),!e.length)return null;const c=r(e,o.concavity);return c.length>3?n([c]):null}var o=m;export{m as convex,o as default};
