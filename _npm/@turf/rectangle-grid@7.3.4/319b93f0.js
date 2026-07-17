/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/rectangle-grid@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{booleanIntersects as t}from"../boolean-intersects@7.3.4/56313654.js";import{convertLength as e,polygon as r,featureCollection as s}from"../helpers@7.3.4/a5e57fe3.js";function o(o,a,n,f={}){const m=[],p=o[0],l=o[1],u=o[2],h=o[3],i=u-p,c=e(a,f.units,"degrees"),M=h-l,b=e(n,f.units,"degrees"),d=Math.floor(Math.abs(i)/c),g=Math.floor(Math.abs(M)/b),k=(M-g*b)/2;let v=p+(i-d*c)/2;for(let e=0;e<d;e++){let e=l+k;for(let s=0;s<g;s++){const s=r([[[v,e],[v,e+b],[v+c,e+b],[v+c,e],[v,e]]],f.properties);f.mask?t(f.mask,s)&&m.push(s):m.push(s),e+=b}v+=c}return s(m)}var a=o;export{a as default,o as rectangleGrid};
