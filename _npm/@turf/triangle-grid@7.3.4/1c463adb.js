/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/triangle-grid@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{distance as r}from"../distance@7.3.4/58cbc6ef.js";import{intersect as p}from"../intersect@7.3.4/d41bed0e.js";import{polygon as e,featureCollection as s}from"../helpers@7.3.4/a5e57fe3.js";function t(t,o,m={}){for(var i=[],u=o/r([t[0],t[1]],[t[2],t[1]],m)*(t[2]-t[0]),a=o/r([t[0],t[1]],[t[0],t[3]],m)*(t[3]-t[1]),f=0,n=t[0];n<=t[2];){for(var l=0,h=t[1];h<=t[3];){var v=null,c=null;f%2==0&&l%2==0?(v=e([[[n,h],[n,h+a],[n+u,h],[n,h]]],m.properties),c=e([[[n,h+a],[n+u,h+a],[n+u,h],[n,h+a]]],m.properties)):f%2==0&&l%2==1?(v=e([[[n,h],[n+u,h+a],[n+u,h],[n,h]]],m.properties),c=e([[[n,h],[n,h+a],[n+u,h+a],[n,h]]],m.properties)):l%2==0&&f%2==1?(v=e([[[n,h],[n,h+a],[n+u,h+a],[n,h]]],m.properties),c=e([[[n,h],[n+u,h+a],[n+u,h],[n,h]]],m.properties)):l%2==1&&f%2==1&&(v=e([[[n,h],[n,h+a],[n+u,h],[n,h]]],m.properties),c=e([[[n,h+a],[n+u,h+a],[n+u,h],[n,h+a]]],m.properties)),m.mask?(p(s([m.mask,v]))&&i.push(v),p(s([m.mask,c]))&&i.push(c)):(i.push(v),i.push(c)),h+=a,l++}f++,n+=u}return s(i)}var o=t;export{o as default,t as triangleGrid};
