// Run with jsdom installed in a separate test prefix:
// NODE_PATH=/tmp/boat-dom-regression/node_modules node --test tests/member-channel-bridge.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(process.env.MEMBER_BRIDGE_SOURCE||require('node:path').join(__dirname,'../app/members/MemberChannelBridge.js'),'utf8');
function setup(html,path='/members'){
 const dom=new JSDOM(html,{url:'https://example.test'+path});
 const w=dom.window;
 let cleanup,deliveries=0,limitExceeded=false;
 class Observer extends w.MutationObserver{
  constructor(callback){super((records,observer)=>{
   deliveries++;
   // Bound the old infinite loop so the regression itself cannot hang CI.
   if(deliveries>30){limitExceeded=true;observer.disconnect();return;}
   callback(records,observer);
  });}
 }
 const ctx={document:w.document,window:w,MutationObserver:Observer,usePathname:()=>path,
 useEffect:fn=>{cleanup=fn();},
 DISCORD_NOTIFICATION_PREFS:[],DISCORD_GUIDE:{},LINE_GUIDE:{},
 CURRENT_BETA_MESSAGE:'期間案内',MEMBERSHIP_GUIDE:{},MEMBERSHIP_GUIDE_ORDER:[]};
 vm.runInNewContext(source.replace(/^import .*;\n/gm,'').replace('export default function','function')+';MemberChannelBridge();',ctx);
 return {w,settle:()=>new Promise(resolve=>setTimeout(resolve,10)),get deliveries(){return deliveries;},get limitExceeded(){return limitExceeded;},close(){cleanup?.();w.close();}};
}
test('linked profile updates settle and browser timers remain runnable',async()=>{
 const x=setup('<aside><section><p>公式LINE ナビ</p></section></aside><main>会員情報を読み込み中...</main>');
 try{
 x.w.document.querySelector('main').innerHTML='<section><h1>会員</h1></section><section><p>BoatStrikers会員IDと公式LINEの紐づけが完了しています。</p></section>';
 await x.settle();
 assert.equal(x.limitExceeded,false,'observer must not reschedule itself forever');
 const count=x.deliveries;await x.settle();assert.equal(x.deliveries,count,'DOM updates must settle');
 assert.equal(x.w.document.querySelectorAll('main [data-membership-guide]').length,1);
 assert.equal(x.w.document.querySelectorAll('aside [data-membership-guide]').length,0);
 x.w.document.querySelector('main p').append('');await x.settle();
 assert.equal(x.limitExceeded,false);
 }finally{x.close();}
});
test('unrelated updates do not repeatedly rewrite identical LINE text',async()=>{
 const x=setup('<main><section><h1>会員</h1></section><section><p>BoatStrikers会員IDと公式LINEを連携できます。</p></section></main>');
 try{
 await x.settle();const p=[...x.w.document.querySelectorAll('p')].find(p=>p.textContent.includes('BoatStrikers会員ID'));
 const textNode=p.firstChild;
 x.w.document.body.append(x.w.document.createElement('div'));await x.settle();
 assert.equal(x.limitExceeded,false);assert.equal(p.firstChild,textNode,'same content must retain its text node');
 }finally{x.close();}
});
test('loading screen receives no guide inside the global menu; hydration adds it once',async()=>{
 const x=setup('<aside><section>menu</section></aside><main>会員情報を読み込み中...</main>');
 try{
 assert.equal(x.w.document.querySelectorAll('[data-membership-guide]').length,0);
 x.w.document.querySelector('main').innerHTML='<section>登録フォーム</section>';await x.settle();
 assert.equal(x.w.document.querySelectorAll('main [data-membership-guide]').length,1);
 }finally{x.close();}
});
test('notification replacement is once-only and cleanup disconnects',async()=>{
 const x=setup('<main><section>会員</section><section>REAL-TIME ALERTS</section></main>');
 try{
 const notifications=x.w.document.querySelector('#notifications');assert.ok(notifications);
 const child=notifications.firstChild;
 x.w.document.body.append(x.w.document.createElement('div'));await x.settle();
 assert.equal(notifications.firstChild,child);assert.equal(x.limitExceeded,false);
 }finally{x.close();}
});
