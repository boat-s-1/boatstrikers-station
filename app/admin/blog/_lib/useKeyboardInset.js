'use client';
import { useEffect,useState } from 'react';
// The visual viewport shrinks when iPhone Safari opens its software keyboard.
export function useKeyboardInset(){
 const [inset,setInset]=useState(0);
 useEffect(()=>{const viewport=window.visualViewport;if(!viewport)return;
   const update=()=>{const next=Math.max(0,Math.round(window.innerHeight-viewport.height-viewport.offsetTop));setInset(next);
     if(next>100&&document.activeElement?.matches('input,textarea,select'))document.activeElement.scrollIntoView({block:'center',behavior:'instant'});
   };
   viewport.addEventListener('resize',update);viewport.addEventListener('scroll',update);update();
   return ()=>{viewport.removeEventListener('resize',update);viewport.removeEventListener('scroll',update);};
 },[]);return inset;
}
