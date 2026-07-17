/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/rhumb-destination@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{convertLength as t,point as a,degreesToRadians as h,earthRadius as n}from"../helpers@7.3.4/a5e57fe3.js";import{getCoord as r}from"../invariant@7.3.4/0f53e08e.js";function s(s,M,e,o={}){const i=M<0;let m=t(Math.abs(M),o.units,"meters");i&&(m=-Math.abs(m));const u=r(s),c=function(t,a,r,s){s=void 0===s?n:Number(s);const M=a/s,e=t[0]*Math.PI/180,o=h(t[1]),i=h(r),m=M*Math.cos(i);let u=o+m;Math.abs(u)>Math.PI/2&&(u=u>0?Math.PI-u:-Math.PI-u);const c=Math.log(Math.tan(u/2+Math.PI/4)/Math.tan(o/2+Math.PI/4)),p=Math.abs(c)>1e-11?m/c:Math.cos(o),I=M*Math.sin(i)/p;return[(180*(e+I)/Math.PI+540)%360-180,180*u/Math.PI]}(u,m,e);return c[0]+=c[0]-u[0]>180?-360:u[0]-c[0]>180?360:0,a(c,o.properties)}var M=s;export{M as default,s as rhumbDestination};
