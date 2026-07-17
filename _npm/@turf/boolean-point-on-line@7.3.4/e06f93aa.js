/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@turf/boolean-point-on-line@7.3.4/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{getCoord as t,getCoords as a}from"../invariant@7.3.4/0f53e08e.js";function n(n,s,r={}){const h=t(n),b=a(s);for(let t=0;t<b.length-1;t++){let a=!1;if(r.ignoreEndVertices&&(0===t&&(a="start"),t===b.length-2&&(a="end"),0===t&&t+1===b.length-1&&(a="both")),e(b[t],b[t+1],h,a,void 0===r.epsilon?null:r.epsilon))return!0}return!1}function e(t,a,n,e,s){const r=n[0],h=n[1],b=t[0],i=t[1],o=a[0],l=a[1],M=o-b,u=l-i,f=(n[0]-b)*u-(n[1]-i)*M;if(null!==s){if(Math.abs(f)>s)return!1}else if(0!==f)return!1;return Math.abs(M)===Math.abs(u)&&0===Math.abs(M)?!e&&(n[0]===t[0]&&n[1]===t[1]):e?"start"===e?Math.abs(M)>=Math.abs(u)?M>0?b<r&&r<=o:o<=r&&r<b:u>0?i<h&&h<=l:l<=h&&h<i:"end"===e?Math.abs(M)>=Math.abs(u)?M>0?b<=r&&r<o:o<r&&r<=b:u>0?i<=h&&h<l:l<h&&h<=i:"both"===e&&(Math.abs(M)>=Math.abs(u)?M>0?b<r&&r<o:o<r&&r<b:u>0?i<h&&h<l:l<h&&h<i):Math.abs(M)>=Math.abs(u)?M>0?b<=r&&r<=o:o<=r&&r<=b:u>0?i<=h&&h<=l:l<=h&&h<=i}var s=n;export{n as booleanPointOnLine,s as default};
