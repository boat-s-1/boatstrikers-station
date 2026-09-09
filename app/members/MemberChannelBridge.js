"use client";

import { useEffect } from "react";

export default function MemberChannelBridge(){
  useEffect(()=>{
    if(window.location.pathname!=="/members")return;

    const apply=()=>{
      const sections=[...document.querySelectorAll("section")];
      const notificationSection=sections.find(section=>section.textContent?.includes("LINE通知設定"));
      if(notificationSection&&!notificationSection.dataset.channelBridge){
        notificationSection.dataset.channelBridge="1";
        notificationSection.innerHTML=`
          <div style="display:grid;gap:14px">
            <div style="padding:18px;border:1px solid #d8eee0;border-radius:18px;background:linear-gradient(135deg,#f4fff7,#ffffff)">
              <div style="font-size:11px;font-weight:900;letter-spacing:.12em;color:#08a64a">OFFICIAL LINE</div>
              <h2 style="margin:7px 0 8px;font-size:22px;color:#10233d">無料情報を受け取る</h2>
              <p style="margin:0 0 14px;line-height:1.7;color:#526176">今日の注目情報、無料記事、YouTube更新、キャンペーンなどBoatStrikersの無料情報をLINEでお届けします。</p>
              <a href="https://lin.ee/Pf3FEEQ" target="_blank" rel="noreferrer" style="display:block;text-align:center;padding:13px 16px;border-radius:12px;background:#06c755;color:white;font-weight:900;text-decoration:none">公式LINEを開く</a>
            </div>

            <div style="padding:18px;border:1px solid #cfd5ff;border-radius:18px;background:linear-gradient(135deg,#f4f5ff,#ffffff)">
              <div style="font-size:11px;font-weight:900;letter-spacing:.12em;color:#5865f2">BOATSTRIKERS DISCORD</div>
              <h2 style="margin:7px 0 8px;font-size:22px;color:#10233d">コミュニティに参加＋PREMIUM限定通知</h2>
              <p style="margin:0 0 10px;line-height:1.7;color:#526176">DiscordはBoatStrikersのコミュニティです。無料参加エリアに加えて、有料会員は一果・初音・キイナ・全アラートの限定通知を利用できます。</p>
              <div style="display:grid;gap:7px;margin:13px 0 15px;color:#24344f;font-weight:800;font-size:14px">
                <div>💬 コミュニティ参加</div>
                <div>🏁 一果｜PREMIUM通知</div>
                <div>🌸 初音｜PREMIUM通知</div>
                <div>🚨 キイナ｜PREMIUM通知</div>
                <div>⚡ 全アラート｜PREMIUM限定</div>
              </div>
              <a href="/members/discord" style="display:block;text-align:center;padding:13px 16px;border-radius:12px;background:#5865f2;color:white;font-weight:900;text-decoration:none">Discordに参加・通知設定</a>
              <a href="/members/ichika-consult" style="display:block;text-align:center;margin-top:9px;padding:12px 16px;border-radius:12px;border:1px solid #5865f2;color:#4350d8;font-weight:900;text-decoration:none;background:white">一果に相談！ PREMIUM</a>
            </div>
          </div>
        `;
      }

      for(const section of sections){
        if(!section.textContent?.includes("公式LINE"))continue;
        const paragraphs=[...section.querySelectorAll("p")];
        for(const p of paragraphs){
          if(p.textContent?.includes("下の「LINE通知設定」")){
            p.textContent="BoatStrikers会員IDと公式LINEの紐づけが完了しています。LINEでは無料情報・重要なお知らせをお届けします。リアルタイムのPREMIUM通知はDiscordをご利用ください。";
          }
        }
      }
    };

    apply();
    const observer=new MutationObserver(apply);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);
  return null;
}
