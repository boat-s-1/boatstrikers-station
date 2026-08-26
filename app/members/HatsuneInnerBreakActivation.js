"use client";

import { useEffect } from "react";

export default function HatsuneInnerBreakActivation(){
  useEffect(()=>{
    let timer=null;

    const apply=()=>{
      const strong=[...document.querySelectorAll("strong")].find(el=>
        el.textContent?.includes("初音・女子戦激アツ") ||
        el.textContent?.includes("初音・女子イン崩れ理論")
      );
      if(!strong)return;

      let row=strong.parentElement;
      while(row && !row.querySelector("button[aria-pressed]")) row=row.parentElement;
      if(!row)return;

      const small=row.querySelector("small");
      const em=row.querySelector("em");
      const button=row.querySelector("button[aria-pressed]");

      strong.textContent="初音・女子イン崩れ理論";
      if(small)small.textContent="②が①より展示0.05秒・1周0.10秒以上速い女子戦を通知";
      if(em)em.remove();

      const linked=document.body.textContent?.includes("公式LINE連携済み");
      if(button && linked){
        button.disabled=false;
        button.removeAttribute("disabled");
        button.setAttribute(
          "aria-label",
          `初音・女子イン崩れ理論 ${button.getAttribute("aria-pressed")==="true"?"ON":"OFF"}`
        );
      }
    };

    const observer=new MutationObserver(()=>{
      clearTimeout(timer);
      timer=setTimeout(apply,10);
    });

    observer.observe(document.body,{
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:["disabled","aria-pressed"]
    });

    apply();
    const interval=setInterval(apply,500);

    return()=>{
      observer.disconnect();
      clearTimeout(timer);
      clearInterval(interval);
    };
  },[]);

  return null;
}
