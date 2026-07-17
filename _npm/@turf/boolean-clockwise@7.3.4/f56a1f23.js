/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/boolean-clockwise@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{getCoords as t}from"../invariant@7.3.4/0f53e08e.js";function r(r){const n=t(r);let e,o,a=0,f=1;for(;f<n.length;)e=o||n[0],o=n[f],a+=(o[0]-e[0])*(o[1]+e[1]),f++;return a>0}var n=r;export{r as booleanClockwise,n as default};
