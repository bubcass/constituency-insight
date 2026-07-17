/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/destination@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{degreesToRadians as t,lengthToRadians as a,radiansToDegrees as s,point as n}from"../helpers@7.3.4/a5e57fe3.js";import{getCoord as i}from"../invariant@7.3.4/0f53e08e.js";function r(r,o,h,M={}){const e=i(r),p=t(e[0]),m=t(e[1]),c=t(h),f=a(o,M.units),u=Math.asin(Math.sin(m)*Math.cos(f)+Math.cos(m)*Math.sin(f)*Math.cos(c)),v=p+Math.atan2(Math.sin(c)*Math.sin(f)*Math.cos(m),Math.cos(f)-Math.sin(m)*Math.sin(u)),d=s(v),l=s(u);return void 0!==e[2]?n([d,l,e[2]],M.properties):n([d,l],M.properties)}var o=r;export{o as default,r as destination};
