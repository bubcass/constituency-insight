/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/point-grid@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{booleanWithin as r}from"../boolean-within@7.3.4/e5a6c9d3.js";import{distance as o}from"../distance@7.3.4/58cbc6ef.js";import{point as t,featureCollection as m}from"../helpers@7.3.4/a5e57fe3.js";function s(s,e,a={}){a.mask&&!a.units&&(a.units="kilometers");for(var f=[],p=s[0],i=s[1],n=s[2],u=s[3],h=e/o([p,i],[n,i],a)*(n-p),l=e/o([p,i],[p,u],a)*(u-i),k=n-p,v=u-i,c=Math.floor(k/h),d=(v-Math.floor(v/l)*l)/2,M=p+(k-c*h)/2;M<=n;){for(var b=i+d;b<=u;){var w=t([M,b],a.properties);a.mask?r(w,a.mask)&&f.push(w):f.push(w),b+=l}M+=h}return m(f)}var e=s;export{e as default,s as pointGrid};
