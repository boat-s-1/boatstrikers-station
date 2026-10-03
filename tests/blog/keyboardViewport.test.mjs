import test from 'node:test';
import assert from 'node:assert/strict';
import {keyboardViewport,observeKeyboard} from '../../lib/blog/keyboardViewport.mjs';
test('keyboard opening/closing, viewport offset and obscured title/dialogue/SEO fields',()=>{
 assert.deepEqual(keyboardViewport({innerHeight:800,height:800}),{inset:0,open:false,obscured:false});
 assert.equal(keyboardViewport({innerHeight:800,height:700}).open,false);
 for(const field of [{fieldTop:600,fieldBottom:644},{fieldTop:450,fieldBottom:560},{fieldTop:0,fieldBottom:44}])assert.equal(keyboardViewport({innerHeight:800,height:480,offsetTop:20,...field}).obscured,true);
 assert.equal(keyboardViewport({innerHeight:800,height:480,offsetTop:20,fieldTop:200,fieldBottom:244}).obscured,false);
 assert.equal(keyboardViewport({innerHeight:800,height:800,fieldTop:600,fieldBottom:644}).inset,0);
});
test('viewport scrolling never fights user scroll, focus checks hidden fields, closing restores inset and cleanup cancels work',()=>{
 const viewport=Object.assign(new EventTarget(),{height:480,offsetTop:0}),doc=new EventTarget();let scrolled=0,frame=null;
 doc.activeElement={matches:()=>true,getBoundingClientRect:()=>({top:650,bottom:760}),scrollIntoView:()=>scrolled++};
 const win={innerHeight:800,visualViewport:viewport,requestAnimationFrame(fn){frame=fn;return 1;},cancelAnimationFrame(){frame=null;}};
 const values=[],flush=()=>{const fn=frame;frame=null;fn?.();};
 const stop=observeKeyboard(win,doc,v=>values.push(v));flush();assert.equal(scrolled,1);
 viewport.dispatchEvent(new Event('scroll'));flush();assert.equal(scrolled,1);
 doc.dispatchEvent(new Event('focusin'));flush();assert.equal(scrolled,2);
 viewport.height=800;viewport.dispatchEvent(new Event('resize'));flush();assert.equal(values.at(-1),0);assert.equal(scrolled,2);
 viewport.dispatchEvent(new Event('resize'));stop();flush();assert.equal(values.length,4);
});
