/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/tinyqueue@3.0.0/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
class t{constructor(t=[],h=(t,h)=>t<h?-1:t>h?1:0){if(this.data=t,this.length=this.data.length,this.compare=h,this.length>0)for(let t=(this.length>>1)-1;t>=0;t--)this._down(t)}push(t){this.data.push(t),this._up(this.length++)}pop(){if(0===this.length)return;const t=this.data[0],h=this.data.pop();return--this.length>0&&(this.data[0]=h,this._down(0)),t}peek(){return this.data[0]}_up(t){const{data:h,compare:s}=this,a=h[t];for(;t>0;){const i=t-1>>1,e=h[i];if(s(a,e)>=0)break;h[t]=e,t=i}h[t]=a}_down(t){const{data:h,compare:s}=this,a=this.length>>1,i=h[t];for(;t<a;){let a=1+(t<<1);const e=a+1;if(e<this.length&&s(h[e],h[a])<0&&(a=e),s(h[a],i)>=0)break;h[t]=h[a],t=a}h[t]=i}}export{t as default};
