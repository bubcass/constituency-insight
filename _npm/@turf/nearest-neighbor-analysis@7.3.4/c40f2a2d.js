/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/nearest-neighbor-analysis@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{area as e}from"../area@7.3.4/d6ba3661.js";import{bbox as r}from"../bbox@7.3.4/59288137.js";import{bboxPolygon as t}from"../bbox-polygon@7.3.4/d090b42f.js";import{centroid as m}from"../centroid@7.3.4/b840a8be.js";import{distance as o}from"../distance@7.3.4/58cbc6ef.js";import{nearestPoint as n}from"../nearest-point@7.3.4/b0def124.js";import{featureEach as s}from"../meta@7.3.4/1244e006.js";import{featureCollection as i,convertArea as p}from"../helpers@7.3.4/a5e57fe3.js";function a(a,f){const u=(f=f||{}).studyArea||t(r(a)),c=f.properties||{},d=f.units||"kilometers",b=[];s(a,(e=>{b.push(m(e))}));const l=b.length,h=b.map(((e,r)=>{const t=i(b.filter(((e,t)=>t!==r)));return o(e,n(e,t).geometry.coordinates,{units:d})})).reduce(((e,r)=>e+r),0)/l,g=l/p(e(u),"meters",d),x=1/(2*Math.sqrt(g)),y=.26136/Math.sqrt(l*g);return c.nearestNeighborAnalysis={units:d,arealUnits:d+"²",observedMeanDistance:h,expectedMeanDistance:x,nearestNeighborIndex:h/x,numberOfPoints:l,zScore:(h-x)/y},u.properties=c,u}var f=a;export{f as default,a as nearestNeighborAnalysis};
