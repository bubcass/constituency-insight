/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/center-of-mass@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{convex as r}from"../convex@7.3.4/86e63121.js";import{centroid as e}from"../centroid@7.3.4/b840a8be.js";import{point as t}from"../helpers@7.3.4/a5e57fe3.js";import{getType as o,getCoord as p}from"../invariant@7.3.4/0f53e08e.js";import{coordEach as n}from"../meta@7.3.4/1244e006.js";function i(m,s={}){switch(o(m)){case"Point":return t(p(m),s.properties);case"Polygon":var f=[];n(m,(function(r){f.push(r)}));var u,a,c,v,l,d,h,g,x=e(m,{properties:s.properties}),y=x.geometry.coordinates,P=0,w=0,b=0,j=f.map((function(r){return[r[0]-y[0],r[1]-y[1]]}));for(u=0;u<f.length-1;u++)v=(a=j[u])[0],d=a[1],l=(c=j[u+1])[0],b+=g=v*(h=c[1])-l*d,P+=(v+l)*g,w+=(d+h)*g;if(0===b)return x;var k=1/(6*(.5*b));return t([y[0]+k*P,y[1]+k*w],s.properties);default:var q=r(m);return q?i(q,{properties:s.properties}):e(m,{properties:s.properties})}}var m=i;export{i as centerOfMass,m as default};
