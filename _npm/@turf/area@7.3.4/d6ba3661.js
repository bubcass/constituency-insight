/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/area@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{earthRadius as t}from"../helpers@7.3.4/a5e57fe3.js";import{geomReduce as n}from"../meta@7.3.4/1244e006.js";function e(t){return n(t,((t,n)=>t+function(t){let n,e=0;switch(t.type){case"Polygon":return r(t.coordinates);case"MultiPolygon":for(n=0;n<t.coordinates.length;n++)e+=r(t.coordinates[n]);return e;case"Point":case"MultiPoint":case"LineString":case"MultiLineString":return 0}return 0}(n)),0)}function r(t){let n=0;if(t&&t.length>0){n+=Math.abs(a(t[0]));for(let e=1;e<t.length;e++)n-=Math.abs(a(t[e]))}return n}var o=t*t/2,i=Math.PI/180;function a(t){const n=t.length-1;if(n<=2)return 0;let e=0,r=0;for(;r<n;){const o=t[r],a=t[r+1===n?0:r+1],s=t[r+2>=n?(r+2)%n:r+2],u=o[0]*i,c=a[1]*i;e+=(s[0]*i-u)*Math.sin(c),r++}return e*o}var s=e;export{e as area,s as default};
