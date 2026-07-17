/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/bbox@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{coordEach as r}from"../meta@7.3.4/1244e006.js";function t(t,e={}){if(null!=t.bbox&&!0!==e.recompute)return t.bbox;const o=[1/0,1/0,-1/0,-1/0];return r(t,(r=>{o[0]>r[0]&&(o[0]=r[0]),o[1]>r[1]&&(o[1]=r[1]),o[2]<r[0]&&(o[2]=r[0]),o[3]<r[1]&&(o[3]=r[1])})),o}var e=t;export{t as bbox,e as default};
