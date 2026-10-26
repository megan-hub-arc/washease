import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
async function run(fetch) {
 const effects=[], errors=[], orders=[], exports={}; let redirected=false;
 const react={useEffect: f=>effects.push(f),useRef: value=>({current:value}),useState: value=>[value,x=>errors.push(x)]};
 const modules={react,'react-dom':{createPortal:()=>null},'react/jsx-runtime':{jsx:()=>null,jsxs:()=>null},'next/navigation':{useRouter:()=>({replace:()=>{redirected=true;}})},'@/lib/api':{API_URL:'/api'},'@/lib/customer-feedback':{customerOrderFeedback:()=>null},'@/lib/customer-live':{connectCustomerLive:()=>()=>{}},'@/lib/requested-times':{requestedTimeLabel:()=>''}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/CustomerLiveUpdates.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>modules[n],fetch,AbortController,Intl,Date,localStorage:{getItem:()=> 'test',removeItem:()=>{}},document:{visibilityState:'visible',addEventListener:()=>{},removeEventListener:()=>{}},window:{setTimeout:()=>1,clearTimeout:()=>{},setInterval:()=>1,clearInterval:()=>{},addEventListener:()=>{},removeEventListener:()=>{}}});
 exports.default({onOrdersUpdated:x=>orders.push(x)}); const cleanup=effects[0]();
 await new Promise(resolve=>setImmediate(resolve));
 return {orders,errors,redirected:()=>redirected,cleanup};
}
const ok=data=>({status:200,ok:true,json:async()=>data});
test('orders refresh when notification endpoint fails',async()=>{const h=await run(async url=>url.includes('notifications')?{status:500,ok:false}:ok([{id:1}]));assert.equal(h.orders.length,1);assert.ok(h.errors.some(x=>typeof x==='string'&&x.includes('Saved notifications could not refresh')));h.cleanup();});
test('failed orders preserve existing state and report the failing resource',async()=>{const h=await run(async url=>url.includes('notifications')?ok({notifications:[],unread_count:0,last_page:1}):{status:503,ok:false});assert.equal(h.orders.length,0);assert.ok(h.errors.some(x=>typeof x==='string'&&x.includes('Orders could not refresh')));h.cleanup();});
test('expired session redirects instead of accepting refreshed orders',async()=>{const h=await run(async()=>({status:401,ok:false}));assert.equal(h.redirected(),true);assert.equal(h.orders.length,0);h.cleanup();});
test('orders are published without waiting for a stalled notification request',async()=>{let finish;const h=await run(async url=>url.includes('notifications')?new Promise(resolve=>{finish=resolve;}):ok([{id:2}]));assert.equal(h.orders.length,1);finish(ok({notifications:[],unread_count:0,last_page:1}));h.cleanup();});
