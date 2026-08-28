'use client';
import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function ExhibitionAutoRefresh({raceDate,closingTime}) {
  const router=useRouter();
  const [pending,startTransition]=useTransition();
  useEffect(()=>{
    const timer=setInterval(()=>{
      const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
      const close=closingTime ? Date.parse(String(closingTime).includes('T') ? closingTime : `${raceDate}T${String(closingTime).slice(0,8)}+09:00`) : NaN;
      if(document.hidden || pending || raceDate!==today || (Number.isFinite(close) && Date.now()>close+120000))return;
      startTransition(()=>router.refresh());
    },15000);
    return ()=>clearInterval(timer);
  },[router,pending,raceDate,closingTime]);
  return <small style={{display:'block',margin:'8px 0',color:'#607080'}}>展示情報：保存済みの有効値を表示 · 当日の締切前は15秒ごとに再読込{pending?'（更新中）':''}</small>;
}
