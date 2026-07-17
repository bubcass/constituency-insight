/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/line-slice-along@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{bearing as t}from"../bearing@7.3.4/2c3cb3af.js";import{distance as e}from"../distance@7.3.4/58cbc6ef.js";import{destination as r}from"../destination@7.3.4/1a8912b6.js";import{isObject as n,lineString as i}from"../helpers@7.3.4/a5e57fe3.js";function o(o,s,u,m={}){if(!n(m))throw new Error("options is invalid");const{units:p="kilometers"}=m;var f,a=[];if("Feature"===o.type)f=o.geometry.coordinates;else{if("LineString"!==o.type)throw new Error("input must be a LineString Feature or Geometry");f=o.coordinates}const h=f.length;let l,g,d,c=0;for(let n=0;n<f.length&&!(s>=c&&n===f.length-1);n++){if(c>s&&0===a.length){let e=s-c;if(!e)return a.push(f[n]),i(a);g=t(f[n],f[n-1])-180,d=r(f[n],e,g,{units:p}),a.push(d.geometry.coordinates)}if(c>=u)return l=u-c,l?(g=t(f[n],f[n-1])-180,d=r(f[n],l,g,{units:p}),a.push(d.geometry.coordinates),i(a)):(a.push(f[n]),i(a));if(c>=s&&a.push(f[n]),n===f.length-1)return i(a);c+=e(f[n],f[n+1],{units:p})}if(c<s&&f.length===h)throw new Error("Start position is beyond line");var y=f[f.length-1];return i([y,y])}var s=o;export{s as default,o as lineSliceAlong};
