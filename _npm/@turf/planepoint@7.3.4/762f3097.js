/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/planepoint@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{getCoord as o,getGeom as r}from"../invariant@7.3.4/0f53e08e.js";function t(t,e){const n=o(t),i=r(e).coordinates[0];if(i.length<4)throw new Error("OuterRing of a Polygon must have 4 or more Positions.");const a="Feature"===e.type&&e.properties||{},s=a.a,u=a.b,f=a.c,m=n[0],p=n[1],v=i[0][0],c=i[0][1],d=void 0!==s?s:i[0][2],g=i[1][0],h=i[1][1],l=void 0!==u?u:i[1][2],w=i[2][0],y=i[2][1],P=void 0!==f?f:i[2][2];return(P*(m-v)*(p-h)+d*(m-g)*(p-y)+l*(m-w)*(p-c)-l*(m-v)*(p-y)-P*(m-g)*(p-c)-d*(m-w)*(p-h))/((m-v)*(p-h)+(m-g)*(p-y)+(m-w)*(p-c)-(m-v)*(p-y)-(m-g)*(p-c)-(m-w)*(p-h))}var e=t;export{e as default,t as planepoint};
