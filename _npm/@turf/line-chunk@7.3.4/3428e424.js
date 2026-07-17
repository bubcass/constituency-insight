/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/line-chunk@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{length as r}from"../length@7.3.4/307c22ef.js";import{lineSliceAlong as e}from"../line-slice-along@7.3.4/dbb48690.js";import{flattenEach as t}from"../meta@7.3.4/1244e006.js";import{isObject as o,featureCollection as n}from"../helpers@7.3.4/a5e57fe3.js";function i(i,s,m={}){if(!o(m))throw new Error("options is invalid");const{units:f="kilometers",reverse:u=!1}=m;if(!i)throw new Error("geojson is required");if(s<=0)throw new Error("segmentLength must be greater than 0");const a=[];return t(i,(t=>{u&&(t.geometry.coordinates=t.geometry.coordinates.reverse()),function(t,o,n,i){var s=r(t,{units:n});if(s<=o)return i(t);var m=s/o;Number.isInteger(m)||(m=Math.floor(m)+1);for(var f=0;f<m;f++){i(e(t,o*f,o*(f+1),{units:n}))}}(t,s,f,(r=>{a.push(r)}))})),n(a)}var s=i;export{s as default,i as lineChunk};
