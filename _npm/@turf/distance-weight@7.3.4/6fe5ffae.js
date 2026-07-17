/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/distance-weight@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{centroid as t}from"../centroid@7.3.4/b840a8be.js";import{getCoord as n}from"../invariant@7.3.4/0f53e08e.js";import{featureEach as o}from"../meta@7.3.4/1244e006.js";function r(t,o,r=2){const e=n(t),a=n(o),l=e[0]-a[0],f=e[1]-a[1];return 1===r?Math.abs(l)+Math.abs(f):Math.pow(Math.pow(l,r)+Math.pow(f,r),1/r)}function e(n,e){var a,l;const f=(e=e||{}).threshold||1e4,h=e.p||2,s=null!=(a=e.binary)&&a,p=e.alpha||-1,m=null!=(l=e.standardization)&&l,i=[];o(n,(n=>{i.push(t(n))}));const u=[];for(let t=0;t<i.length;t++)u[t]=[];for(let t=0;t<i.length;t++)for(let n=t;n<i.length;n++){t===n&&(u[t][n]=0);const o=r(i[t],i[n],h);u[t][n]=o,u[n][t]=o}for(let t=0;t<i.length;t++)for(let n=0;n<i.length;n++){const o=u[t][n];0!==o&&(u[t][n]=s?o<=f?1:0:o<=f?Math.pow(o,p):0)}if(m)for(let t=0;t<i.length;t++){const n=u[t].reduce(((t,n)=>t+n),0);for(let o=0;o<i.length;o++)u[t][o]=u[t][o]/n}return u}var a=e;export{a as default,e as distanceWeight,r as pNormDistance};
