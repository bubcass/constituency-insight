/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/bearing@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{degreesToRadians as t,radiansToDegrees as n}from"../helpers@7.3.4/a5e57fe3.js";import{getCoord as a}from"../invariant@7.3.4/0f53e08e.js";function r(o,s,i={}){if(!0===i.final)return function(t,n){let a=r(n,t);return a=(a+180)%360,a}(o,s);const e=a(o),f=a(s),h=t(e[0]),m=t(f[0]),u=t(e[1]),M=t(f[1]),c=Math.sin(m-h)*Math.cos(M),p=Math.cos(u)*Math.sin(M)-Math.sin(u)*Math.cos(M)*Math.cos(m-h);return n(Math.atan2(c,p))}var o=r;export{r as bearing,o as default};
