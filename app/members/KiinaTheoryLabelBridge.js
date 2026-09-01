"use client";

import { useEffect } from "react";

export default function KiinaTheoryLabelBridge(){
  useEffect(()=>{
    const replaceLabels=()=>{
      const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
      let node;
      while((node=walker.nextNode())){
        if(!node.nodeValue?.includes("4→5展開理論"))continue;
        node.nodeValue=node.nodeValue.replaceAll("キイナ・4→5展開理論","キイナ・カド攻め理論").replaceAll("4→5展開理論","カド攻め理論");
      }
    };
    replaceLabels();
    const observer=new MutationObserver(replaceLabels);
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    return()=>observer.disconnect();
  },[]);
  return null;
}
