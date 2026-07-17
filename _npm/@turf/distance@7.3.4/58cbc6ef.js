/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/distance@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{getCoord as t}from"../invariant@7.3.4/0f53e08e.js";import{degreesToRadians as a,radiansToLength as r}from"../helpers@7.3.4/a5e57fe3.js";function n(n,s,h={}){var o=t(n),M=t(s),i=a(M[1]-o[1]),m=a(M[0]-o[0]),p=a(o[1]),e=a(M[1]),f=Math.pow(Math.sin(i/2),2)+Math.pow(Math.sin(m/2),2)*Math.cos(p)*Math.cos(e);return r(2*Math.atan2(Math.sqrt(f),Math.sqrt(1-f)),h.units)}var s=n;export{s as default,n as distance};
