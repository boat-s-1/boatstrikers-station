"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function MemberModeQueryBridge(){
  const pathname=usePathname();

  useEffect(()=>{
    if(pathname!=="/members")return;
    const params=new URLSearchParams(window.location.search);
    if(params.get("mode")!=="login")return;

    let tries=0;
    const timer=setInterval(()=>{
      tries+=1;
      const loginButton=[...document.querySelectorAll("main button")].find(btn=>btn.textContent?.trim()==="ログイン");
      if(loginButton){
        loginButton.click();
        clearInterval(timer);
      }else if(tries>=20){
        clearInterval(timer);
      }
    },50);

    return()=>clearInterval(timer);
  },[pathname]);

  return null;
}
