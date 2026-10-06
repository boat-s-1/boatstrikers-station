// Pure viewport calculation, shared by the browser hook and keyboard regression tests.
export function keyboardViewport({innerHeight,height,offsetTop=0,fieldTop,fieldBottom}) {
 const inset=Math.max(0,Math.round(innerHeight-height-offsetTop));
 const open=inset>100;
 return {inset,open,obscured:open&&Number.isFinite(fieldTop)&&Number.isFinite(fieldBottom)
   &&(fieldTop<offsetTop+16||fieldBottom>offsetTop+height-24)};
}
export function observeKeyboard(win,doc,onInset) {
 const viewport=win.visualViewport;if(!viewport)return ()=>{};
 let frame=null,ensureVisible=false,disposed=false;
 const queue=(scroll)=>{
   ensureVisible ||= scroll;
   if(frame!==null)return;
   frame=win.requestAnimationFrame(()=>{
     frame=null;if(disposed)return;
     const field=doc.activeElement,editable=field?.matches('input,textarea,select');
     const rect=editable?field.getBoundingClientRect():{};
     const layout=keyboardViewport({innerHeight:win.innerHeight,height:viewport.height,offsetTop:viewport.offsetTop,fieldTop:rect.top,fieldBottom:rect.bottom});
     onInset(layout.inset);
     // Viewport scroll events must not recursively re-center the user's input.
     if(ensureVisible&&layout.obscured)field.scrollIntoView({block:'center',behavior:'instant'});
     ensureVisible=false;
   });
 };
 const resize=()=>queue(true),scroll=()=>queue(false),focus=()=>queue(true);
 viewport.addEventListener('resize',resize);viewport.addEventListener('scroll',scroll);doc.addEventListener('focusin',focus);queue(true);
 return ()=>{disposed=true;if(frame!==null)win.cancelAnimationFrame(frame);viewport.removeEventListener('resize',resize);viewport.removeEventListener('scroll',scroll);doc.removeEventListener('focusin',focus);};
}
