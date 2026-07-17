/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/rhumb-distance@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{convertLength as t,earthRadius as a}from"../helpers@7.3.4/a5e57fe3.js";import{getCoord as n}from"../invariant@7.3.4/0f53e08e.js";function r(r,h,o={}){const s=n(r),M=n(h);M[0]+=M[0]-s[0]>180?-360:s[0]-M[0]>180?360:0;const e=function(t,n,r){const h=r=void 0===r?a:Number(r),o=t[1]*Math.PI/180,s=n[1]*Math.PI/180,M=s-o;let e=Math.abs(n[0]-t[0])*Math.PI/180;e>Math.PI&&(e-=2*Math.PI);const m=Math.log(Math.tan(s/2+Math.PI/4)/Math.tan(o/2+Math.PI/4)),u=Math.abs(m)>1e-11?M/m:Math.cos(o),i=Math.sqrt(M*M+u*u*e*e);return i*h}(s,M);return t(e,"meters",o.units)}var h=r;export{h as default,r as rhumbDistance};
