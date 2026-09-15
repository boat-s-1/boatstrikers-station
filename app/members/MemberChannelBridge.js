"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { DISCORD_GUIDE, DISCORD_NOTIFICATION_PREFS, LINE_GUIDE } from "./notificationGuide";
import { CURRENT_BETA_MESSAGE, MEMBERSHIP_GUIDE, MEMBERSHIP_GUIDE_ORDER } from "./planGuide";

function notificationCardsHtml(){
  const prefs=DISCORD_NOTIFICATION_PREFS.map(item=>`<div>${item.icon} ${item.title}｜${item.description}</div>`).join("");
  return `
    <div style="display:grid;gap:14px">
      <div style="padding:18px;border:1px solid #d8eee0;border-radius:18px;background:linear-gradient(135deg,#f4fff7,#ffffff)">
        <div style="font-size:11px;font-weight:900;letter-spacing:.12em;color:#08a64a">OFFICIAL LINE</div>
        <h2 style="margin:7px 0 8px;font-size:22px;color:#10233d">${LINE_GUIDE.label}｜${LINE_GUIDE.role}</h2>
        <p style="margin:0 0 8px;line-height:1.7;color:#526176">${LINE_GUIDE.description}</p>
        <p style="margin:0 0 14px;line-height:1.6;color:#087a38;font-size:13px;font-weight:800">対象：${LINE_GUIDE.audience}</p>
        <div style="margin:0 0 14px;padding:10px 12px;border-radius:12px;background:#e9fff1;color:#315443;font-size:12px;font-weight:800;line-height:1.6">${LINE_GUIDE.note}</div>
        <a href="${LINE_GUIDE.href}" target="_blank" rel="noreferrer" style="display:block;text-align:center;padding:13px 16px;border-radius:12px;background:#06c755;color:white;font-weight:900;text-decoration:none">公式LINEを開く</a>
      </div>

      <div style="padding:18px;border:1px solid #cfd5ff;border-radius:18px;background:linear-gradient(135deg,#f4f5ff,#ffffff)">
        <div style="font-size:11px;font-weight:900;letter-spacing:.12em;color:#5865f2">BOATSTRIKERS DISCORD</div>
        <h2 style="margin:7px 0 8px;font-size:22px;color:#10233d">${DISCORD_GUIDE.label}｜${DISCORD_GUIDE.role}</h2>
        <p style="margin:0 0 8px;line-height:1.7;color:#526176">${DISCORD_GUIDE.description}</p>
        <p style="margin:0 0 12px;line-height:1.6;color:#4350d8;font-size:13px;font-weight:800">対象：${DISCORD_GUIDE.audience}</p>
        <div style="display:grid;gap:7px;margin:13px 0 15px;color:#24344f;font-weight:800;font-size:14px">${prefs}</div>
        <div style="margin:0 0 14px;padding:10px 12px;border-radius:12px;background:#eef0ff;color:#3d4779;font-size:12px;font-weight:800;line-height:1.6">${DISCORD_GUIDE.note}</div>
        <a href="${DISCORD_GUIDE.href}" style="display:block;text-align:center;padding:13px 16px;border-radius:12px;background:#5865f2;color:white;font-weight:900;text-decoration:none">Discordに参加・通知設定</a>
      </div>
    </div>
  `;
}

function membershipGuideHtml(){
  const cards=MEMBERSHIP_GUIDE_ORDER.map(key=>{
    const item=MEMBERSHIP_GUIDE[key];
    const isCurrent=Boolean(item.current);
    const benefits=item.benefits.map(benefit=>`<li style="display:flex;gap:7px;align-items:flex-start"><span style="color:${isCurrent?"#6b5cff":"#159cd5"};font-weight:900">✓</span><span>${benefit}</span></li>`).join("");
    return `
      <div style="position:relative;padding:16px;border:${isCurrent?"2px solid #6b5cff":"1px solid #d9e8f2"};border-radius:18px;background:${isCurrent?"linear-gradient(180deg,#f2f0ff,#fff)":"#fff"};box-shadow:${isCurrent?"0 10px 24px rgba(107,92,255,.14)":"none"}">
        ${isCurrent?'<span style="position:absolute;top:-11px;right:12px;padding:5px 9px;border-radius:999px;background:#6b5cff;color:#fff;font-size:10px;font-weight:900">現在</span>':""}
        <small style="display:block;color:${isCurrent?"#6b5cff":"#159cd5"};font-weight:900;letter-spacing:.08em">${item.label}</small>
        <h3 style="margin:5px 0 5px;color:#10233d;font-size:19px">${item.title}</h3>
        <strong style="display:block;margin-bottom:8px;color:${isCurrent?"#5847e8":"#526176"};font-size:12px">${item.status}</strong>
        <p style="margin:0;color:#617287;font-size:12px;line-height:1.65">${item.description}</p>
        <ul style="margin:12px 0 0;padding:0;list-style:none;display:grid;gap:6px;color:#34475f;font-size:12px;line-height:1.5">${benefits}</ul>
      </div>`;
  }).join("");

  return `
    <section data-membership-guide="1" style="margin:16px auto;padding:18px;max-width:760px;border:1px solid #d9e8f2;border-radius:22px;background:linear-gradient(180deg,#ffffff,#f7fbff);box-sizing:border-box">
      <div style="text-align:center;margin-bottom:14px">
        <div style="font-size:10px;font-weight:900;letter-spacing:.14em;color:#159cd5">MEMBERSHIP</div>
        <h2 style="margin:5px 0 6px;color:#10233d;font-size:22px">会員プランと使える機能</h2>
        <p style="margin:0;color:#617287;font-size:13px;line-height:1.7">${CURRENT_BETA_MESSAGE}</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px" class="member-plan-grid">${cards}</div>
      <p style="margin:12px 0 0;padding:10px 12px;border-radius:12px;background:#fff8e8;color:#765b19;font-size:11px;font-weight:800;line-height:1.6">※ PREMIUMの料金・正式開始時期は未定です。決定後に公式LINE・サイトで案内します。</p>
      <style>@media(max-width:640px){.member-plan-grid{grid-template-columns:1fr!important}}</style>
    </section>
  `;
}

export default function MemberChannelBridge(){
  const pathname=usePathname();
  useEffect(()=>{
    if(pathname!=="/members")return;

    const apply=()=>{
      const main=document.querySelector("main");
      if(!main)return;
      const sections=[...main.querySelectorAll("section")];
      const hero=main.querySelector(":scope > section");

      const oldBenefits=main.querySelector('[data-member-benefits="1"]');
      if(oldBenefits)oldBenefits.remove();
      if(main&&hero&&!main.querySelector('[data-membership-guide="1"]')){
        hero.insertAdjacentHTML("afterend",membershipGuideHtml());
      }

      const notificationSection=sections.find(section=>
        section.textContent?.includes("LINE通知設定")||
        section.textContent?.includes("リアルタイム通知はDiscordへ")||
        section.textContent?.includes("REAL-TIME ALERTS")||
        section.id==="notifications"
      );
      if(notificationSection&&!notificationSection.dataset.channelBridge){
        notificationSection.dataset.channelBridge="1";
        notificationSection.id="notifications";
        notificationSection.innerHTML=`
          <div style="margin-bottom:12px">
            <div style="font-size:10px;font-weight:900;letter-spacing:.14em;color:#159cd5">NOTIFICATION GUIDE</div>
            <h2 style="margin:5px 0 6px;color:#10233d;font-size:22px">LINEとDiscordの使い分け</h2>
            <p style="margin:0;color:#617287;line-height:1.7">LINEは公式案内、β PREMIUM / PREMIUMのリアルタイム通知はDiscord。役割を分けて迷わず使えるようにしています。</p>
          </div>
          ${notificationCardsHtml()}
        `;
      }

      for(const section of sections){
        if(!section.textContent?.includes("公式LINE"))continue;
        const paragraphs=[...section.querySelectorAll("p")];
        for(const p of paragraphs){
          if(p.textContent?.includes("BoatStrikers会員ID")||p.textContent?.includes("LINEは重要なお知らせ")){
            const nextText="BoatStrikers会員IDと公式LINEを連携できます。LINEでは無料情報・重要なお知らせをお届けします。β PREMIUM / PREMIUMのリアルタイム通知はDiscordをご利用ください。";
            // Assigning even identical textContent creates childList mutations.
            if(p.textContent!==nextText)p.textContent=nextText;
          }
        }
      }
    };

    apply();
    // Do not observe our own DOM writes; other React updates remain observed.
    const observer=new MutationObserver(()=>{
      observer.disconnect();
      try{apply();}finally{
        observer.observe(document.body,{childList:true,subtree:true});
      }
    });
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[pathname]);
  return null;
}
