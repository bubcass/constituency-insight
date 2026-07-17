/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/point-in-polygon-hao@1.2.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{orient2d as r}from"../robust-predicates@3.0.3/42820bfa.js";function e(e,t){var n,i,o,a,f,s,u,m,l,d=0,h=e[0],p=e[1],c=t.length;for(n=0;n<c;n++){i=0;var g=t[n],b=g.length-1;if((m=g[0])[0]!==g[b][0]&&m[1]!==g[b][1])throw new Error("First and last coordinates in a ring must be the same");for(a=m[0]-h,f=m[1]-p;i<b;i++){if(s=(l=g[i+1])[0]-h,u=l[1]-p,0===f&&0===u){if(s<=0&&a>=0||a<=0&&s>=0)return 0}else if(u>=0&&f<=0||u<=0&&f>=0){if(0===(o=r(a,s,f,u,0,0)))return 0;(o>0&&u>0&&f<=0||o<0&&u<=0&&f>0)&&d++}m=l,f=u,a=s}}return d%2!=0}export{e as default};
