/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/moran-index@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{distanceWeight as t}from"../distance-weight@7.3.4/6fe5ffae.js";import{featureEach as n}from"../meta@7.3.4/1244e006.js";function o(o,e){var a,s;const l=e.inputField,p=e.threshold||1e5,i=e.p||2,h=null!=(a=e.binary)&&a,f=e.alpha||-1,c=null==(s=e.standardization)||s,d=t(o,{alpha:f,binary:h,p:i,standardization:c,threshold:p}),u=[];n(o,(t=>{const n=t.properties||{};u.push(n[l])}));const m=r(u),M=function(t){const n=r(t);let o=0;for(const r of t)o+=Math.pow(r-n,2);return o/t.length}(u);let g=0,w=0,x=0,z=0;const b=d.length;for(let t=0;t<b;t++){let n=0;for(let o=0;o<b;o++)g+=d[t][o]*(u[t]-m)*(u[o]-m),w+=d[t][o],x+=Math.pow(d[t][o]+d[o][t],2),n+=d[t][o]+d[o][t];z+=Math.pow(n,2)}x*=.5;const v=g/w/M,y=-1/(b-1),I=(b*b*x-b*z+w*w*3)/((b-1)*(b+1)*(w*w))-y*y,N=Math.sqrt(I);return{expectedMoranIndex:y,moranIndex:v,stdNorm:N,zNorm:(v-y)/N}}function r(t){let n=0;for(const o of t)n+=o;return n/t.length}var e=o;export{e as default,o as moranIndex};
