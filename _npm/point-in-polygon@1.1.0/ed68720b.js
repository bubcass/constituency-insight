/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/point-in-polygon@1.1.0/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
var r={exports:{}},t=function(r,t,e,o){var a=r[0],n=r[1],v=!1;void 0===e&&(e=0),void 0===o&&(o=t.length);for(var i=(o-e)/2,s=0,f=i-1;s<i;f=s++){var u=t[e+2*s+0],d=t[e+2*s+1],p=t[e+2*f+0],x=t[e+2*f+1];d>n!=x>n&&a<(p-u)*(n-d)/(x-d)+u&&(v=!v)}return v},e=function(r,t,e,o){var a=r[0],n=r[1],v=!1;void 0===e&&(e=0),void 0===o&&(o=t.length);for(var i=o-e,s=0,f=i-1;s<i;f=s++){var u=t[s+e][0],d=t[s+e][1],p=t[f+e][0],x=t[f+e][1];d>n!=x>n&&a<(p-u)*(n-d)/(x-d)+u&&(v=!v)}return v};r.exports=function(r,o,a,n){return o.length>0&&Array.isArray(o[0])?e(r,o,a,n):t(r,o,a,n)};var o=r.exports.nested=e,a=r.exports.flat=t,n=r.exports;export{n as default,a as flat,o as nested};
