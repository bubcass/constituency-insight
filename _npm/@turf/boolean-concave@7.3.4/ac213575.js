/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/boolean-concave@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{getGeom as t}from"../invariant@7.3.4/0f53e08e.js";function n(n){const r=t(n).coordinates;if(r[0].length<=4)return!1;let e=!1;const o=r[0].length-1;for(let t=0;t<o;t++){const n=r[0][(t+2)%o][0]-r[0][(t+1)%o][0],f=r[0][(t+2)%o][1]-r[0][(t+1)%o][1],i=r[0][t][0]-r[0][(t+1)%o][0],s=n*(r[0][t][1]-r[0][(t+1)%o][1])-f*i;if(0===t)e=s>0;else if(e!==s>0)return!0}return!1}var r=n;export{n as booleanConcave,r as default};
