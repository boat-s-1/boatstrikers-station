"use client";

import { useEffect } from "react";

export default function HatsuneInnerBreakActivation(){
  useEffect(()=>{
    let timer=null;
    const apply=()=>{
      const rows=[...document.querySelectorAll("div")].filter(el=>el.textContent?.includes("初音・女子戦激アツ")||el.textContent?.includes("初音・女子イン崩れ理論"));
      const row=rows.sort((a,b)=>a.textContent.length-b.textContent.length)[0];
      if(!row)return;
      const strong=[...row.querySelectorAll("strong")].find(el=>el.textContent?.includes("初音・"));
      const small=row.querySelector("small");
      const em=row.querySelector("em");
      const button=row.querySelector("button");
      if(strong)strong.textContent="初音・女子イン崩れ理論";
      if(small)small.textContent="②が①より展示0.05秒・1周0.10秒以上速い女子戦を通知";
      if(em)em.remove();
      const linked=document.body.textContent?.includes("公式LINE連携済み");
      if(button&&linked){button.disabled=false;button.setAttribute("aria-label",`初音・女子イン崩れ理論 ${button.getAttribute("aria-pressed")==="true"?"ON":"OFF"}`);}
    };
    const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(apply,20);});
    observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true});
    apply();
    return()=>{observer.disconnect();clearTimeout(timer);};
  },[]);
  return null;
}
