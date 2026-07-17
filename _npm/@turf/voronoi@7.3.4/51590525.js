/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/voronoi@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{isObject as r,featureCollection as o,polygon as e}from"../helpers@7.3.4/a5e57fe3.js";import{collectionOf as t}from"../invariant@7.3.4/0f53e08e.js";import{cloneProperties as i}from"../clone@7.3.4/9edb039d.js";import*as n from"../../d3-voronoi@1.1.2/bfec861e.js";function s(s,p){if(!r(p=p||{}))throw new Error("options is invalid");const m=p.bbox||[-180,-85,180,85];if(!s)throw new Error("points is required");if(!Array.isArray(m))throw new Error("bbox is invalid");return t(s,"Point","points"),o(n.voronoi().x((r=>r.geometry.coordinates[0])).y((r=>r.geometry.coordinates[1])).extent([[m[0],m[1]],[m[2],m[3]]]).polygons(s.features).map((function(r,o){return Object.assign(function(r){return(r=r.slice()).push(r[0]),e([r])}(r),{properties:i(s.features[o].properties)})})))}var p=s;export{p as default,s as voronoi};
