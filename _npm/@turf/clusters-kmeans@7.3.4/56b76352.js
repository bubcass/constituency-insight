/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/clusters-kmeans@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{clone as r}from"../clone@7.3.4/9edb039d.js";import{coordAll as e,featureEach as t}from"../meta@7.3.4/1244e006.js";import s from"../../skmeans@0.9.7/9649a959.js";function u(u,n={}){var m=u.features.length;n.numberOfClusters=n.numberOfClusters||Math.round(Math.sqrt(m/2)),n.numberOfClusters>m&&(n.numberOfClusters=m),!0!==n.mutate&&(u=r(u));var f=e(u),o=f.slice(0,n.numberOfClusters),a=s(f,n.numberOfClusters,o),i={};return a.centroids.forEach((function(r,e){i[e]=r})),t(u,(function(r,e){var t=a.idxs[e];r.properties.cluster=t,r.properties.centroid=i[t]})),u}var n=u;export{u as clustersKmeans,n as default};
