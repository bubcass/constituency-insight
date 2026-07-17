/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/tinyqueue@2.0.3/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
class t{constructor(t=[],s=h){if(this.data=t,this.length=this.data.length,this.compare=s,this.length>0)for(let t=(this.length>>1)-1;t>=0;t--)this._down(t)}push(t){this.data.push(t),this.length++,this._up(this.length-1)}pop(){if(0===this.length)return;const t=this.data[0],h=this.data.pop();return this.length--,this.length>0&&(this.data[0]=h,this._down(0)),t}peek(){return this.data[0]}_up(t){const{data:h,compare:s}=this,i=h[t];for(;t>0;){const a=t-1>>1,e=h[a];if(s(i,e)>=0)break;h[t]=e,t=a}h[t]=i}_down(t){const{data:h,compare:s}=this,i=this.length>>1,a=h[t];for(;t<i;){let i=1+(t<<1),e=h[i];const n=i+1;if(n<this.length&&s(h[n],e)<0&&(i=n,e=h[n]),s(e,a)>=0)break;h[t]=e,t=i}h[t]=a}}function h(t,h){return t<h?-1:t>h?1:0}export{t as default};
