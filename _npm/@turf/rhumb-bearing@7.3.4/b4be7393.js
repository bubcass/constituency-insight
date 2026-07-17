/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/rhumb-bearing@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{degreesToRadians as t,radiansToDegrees as a}from"../helpers@7.3.4/a5e57fe3.js";import{getCoord as n}from"../invariant@7.3.4/0f53e08e.js";function r(t,a,r={}){let e;e=r.final?h(n(a),n(t)):h(n(t),n(a));return e>180?-(360-e):e}function h(n,r){const h=t(n[1]),e=t(r[1]);let o=t(r[0]-n[0]);o>Math.PI&&(o-=2*Math.PI),o<-Math.PI&&(o+=2*Math.PI);const M=Math.log(Math.tan(e/2+Math.PI/4)/Math.tan(h/2+Math.PI/4)),f=Math.atan2(o,M);return(a(f)+360)%360}var e=r;export{e as default,r as rhumbBearing};
