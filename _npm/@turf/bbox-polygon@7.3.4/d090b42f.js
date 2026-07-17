/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/bbox-polygon@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{polygon as r}from"../helpers@7.3.4/a5e57fe3.js";function o(o,t={}){const e=Number(o[0]),n=Number(o[1]),p=Number(o[2]),s=Number(o[3]);if(6===o.length)throw new Error("@turf/bbox-polygon does not support BBox with 6 positions");const u=[e,n];return r([[u,[p,n],[p,s],[e,s],u]],t.properties,{bbox:o,id:t.id})}var t=o;export{o as bboxPolygon,t as default};
