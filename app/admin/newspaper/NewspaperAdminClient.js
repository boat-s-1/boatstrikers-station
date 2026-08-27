"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./newspaperAdmin.module.css";

const STORAGE_KEY = "boatstrikers:newspaper-phase2";

const MODES = [
  ["ichika", "🌸", "一果"],
  ["kiina", "⚡", "キイナ"],
  ["hatsune", "👗", "初音"],
  ["grade", "🏆", "12R特別紙"],
  ["sns", "📱", "SNS画像"],
  ["sticker", "✨", "速報ステッカー"],
];

const HEADERS = {
  ichika: { previous: "/admin-newspaper/ichika-previous.png", live: "/admin-newspaper/ichika-live.png" },
  kiina: { previous: "/admin-newspaper/kiina-previous.jpg", live: "/admin-newspaper/kiina-live.jpg" },
  hatsune: { previous: "/admin-newspaper/hatsune-previous.jpg", live: "/admin-newspaper/hatsune-live.jpg" },
  grade: { previous: "/admin-newspaper/grade.jpg", live: "/admin-newspaper/grade.jpg" },
};

const STAMPS = {
  "なし": "",
  "本命": "/admin-newspaper/stamp-honmei.png",
  "激アツ": "/admin-newspaper/stamp-gekiatsu.png",
  "鉄板": "/admin-newspaper/stamp-teppan.png",
  "穴狙い": "/admin-newspaper/stamp-ana.png",
  "見": "/admin-newspaper/stamp-mi.png",
  "危険": "/admin-newspaper/stamp-kiken.png",
  "波乱注意": "/admin-newspaper/stamp-haran.png",
};

const LIVE_STAMPS = {
  "なし": "",
  "波乱注意": "/admin-newspaper/stamp-haran.png",
  "鉄板": "/admin-newspaper/stamp-teppan.png",
  "見": "/admin-newspaper/stamp-mi.png",
};

const KIINA_STAMPS = {
  "なし": "",
  "イン信用しない": "/admin-newspaper/kiina-no-inner.png",
  "展示次第": "/admin-newspaper/kiina-tenji.png",
  "モーター抜群": "/admin-newspaper/kiina-motor.png",
  "オッズがつかない": "/admin-newspaper/kiina-odds.png",
  "荒れそうだけど": "/admin-newspaper/kiina-are.png",
  "4コースが": "/admin-newspaper/kiina-course4.png",
};

const STICKER_FRAMES = {
  "鉄板": "/admin-newspaper/frames/teppan.jpg",
  "危険": "/admin-newspaper/frames/kiken.jpg",
  "ヴィーナス": "/admin-newspaper/frames/venus.jpg",
  "5アタマ": "/admin-newspaper/frames/five_atama.jpg",
  "プレミア": "/admin-newspaper/frames/premium.jpg",
};

const COURSE_NAMES = [
  "桐生","戸田","江戸川","平和島","多摩川","浜名湖","蒲郡","常滑","津","三国","びわこ","住之江",
  "尼崎","鳴門","丸亀","児島","宮島","徳山","下関","若松","芦屋","福岡","唐津","大村",
];
const BOATS = Array.from({length:6},(_,i)=>`${i+1}号艇`);

function todayJst() {
  return new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
}

const defaultPickups = Array.from({ length: 6 }, (_, i) => ({
  name: `${i + 1}号艇`,
  comment: i === 0 ? "近況リズム良好。ターン回りに安定感。" : "展開ひとつで連圏。",
  image: "",
}));

const initial = {
  mode: "ichika", edition: "previous", raceDate: todayJst(), racePlace: "丸亀", raceNo: "1R",
  stamp: "本命", liveStamp: "なし", kiinaStamp: "なし", characterImage: "", backgroundImage: "",
  honmei: "1号艇", nigeRate: 84, upRate: 11, wave: 28, dangerBoat: "なし",
  selectedBoats: ["1号艇","2号艇","3号艇"],
  mainComment: "1号艇中心だが2号艇の差し注意！",
  boatScores: {1:82,2:67,3:58,4:48,5:44,6:36},
  boatComments: {1:"インから先マイできる足。",2:"差し残しに注意。",3:"握って攻める展開なら連圏。",4:"展開待ち。",5:"まくり差しの余地あり。",6:"大外で展開待ち。"},
  tenjiRank: "S", tenjiTime: "6.71", shinnyu: "123/456", mainBet: "1-2-3", subBets: "1-3-2\n1-2-5",
  upBoat: "なし", hitRate: 80, markMain: "1", markSecond: "2", markThird: "5",
  motorEval: "1号艇は出足型、3号艇の伸びが節イチ級！", liveComment: "展示は1号艇優勢！",
  kiina5Rate: 72, kiinaStars: "★★★★★", anaTarget: "5号艇のまくり差し", warningMessage: "波乱警報発令中！万舟のチャンス！",
  checkItems: {"インの足":true,"4号艇の伸び":false,"スタ展気配":true,"風向き":false,"展示タイム":true},
  slit: {1:0,2:0,3:0,4:0,5:0,6:0}, slitBg: "#111111", laneBg: "#222222", slitLine: "#ffcc00", diff4: "-0.05",
  hatsuneHonmei: "1号艇", hatsuneRhythm: "好調", wallRank: "A", hatsuneBet: "1-23-4", weightMemo: "チルト0.5", pickupCount: 2, pickups: defaultPickups,
  gradeTitle: "三姫頂上決戦新聞", gradeDate: todayJst(), gradePlace: "丸亀", gradeHit: "本日の勝負12R",
  gradeRows: Array.from({ length: 12 }, (_, i) => ({race:`${i+1}R`,grade:i===11?"勝負":"通常",rank:i===11?"S":"A",ichika:"○",hatsune:"△",kiina:"穴",main:"1-2-3",sub:"1-3-2",memo:i===11?"最終レース勝負":"",haran:i%4===0?"高":"中",deadline:""})),
  snsMode: "危険", snsDeadline: "15:24", snsRate: 28, snsMain: "3-2-5", snsStep1: "1号艇は流される", snsStep2: "2号艇が絞って攻める", snsStep3: "3号艇が差して決着へ", snsAxis: "3号艇",
  frameType: "鉄板", stickerMain: "92%", stickerSub: "信頼度", stickerBet: "1-2-3", stickerMemo: "一果の鉄板候補",
};

function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");}
function clamp(v,min=0,max=100){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):min;}
function textLines(value,x,y,opts={}){const {size=28,fill="#26384a",weight=700,line=1.45,max=4,anchor="start"}=opts;const lines=String(value||"").split(/\r?\n/).slice(0,max);return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" font-family="Arial,'Noto Sans JP',sans-serif">${lines.map((t,i)=>`<tspan x="${x}" dy="${i===0?0:size*line}">${esc(t)}</tspan>`).join("")}</text>`;}
function img(href,x,y,w,h,extra=""){return href?`<image href="${esc(href)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" ${extra}/>`:"";}
function stampOverlay(href,x=760,y=420,size=210,rotate=-10){if(!href)return"";return `<g transform="rotate(${rotate} ${x+size/2} ${y+size/2})">${img(href,x,y,size,size,'opacity=".92"')}</g>`;}

function baseCanvas(header,title,state,accent,dark,body=""){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1500" viewBox="0 0 1080 1500">
    <rect width="1080" height="1500" fill="#f1f4f8"/>
    <rect x="32" y="32" width="1016" height="1436" rx="34" fill="#fff" stroke="${accent}" stroke-width="5"/>
    ${state.backgroundImage?img(state.backgroundImage,32,32,1016,1436,'opacity=".18"'):""}
    ${img(header,60,60,960,170)}
    <rect x="60" y="250" width="960" height="150" rx="24" fill="${dark}"/>
    <text x="90" y="305" fill="${accent}" font-size="24" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${state.edition==="live"?"LIVE / JUST BEFORE":"PRE-RACE EDITION"}</text>
    <text x="90" y="360" fill="#fff" font-size="44" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(title)}</text>
    <text x="980" y="308" fill="#fff" font-size="22" font-weight="800" text-anchor="end" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.raceDate)}</text>
    <text x="980" y="365" fill="#fff" font-size="40" font-weight="900" text-anchor="end" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.racePlace)} ${esc(state.raceNo)}</text>
    ${body}${img("/admin-newspaper/footer.png",174,1390,732,104)}
  </svg>`;
}

function buildIchika(state){
  const accent="#ff4f93",dark="#692348",header=HEADERS.ichika[state.edition];
  let rows="";
  for(let i=1;i<=6;i++){
    const score=clamp(state.boatScores[i]),y=730+(i-1)*70,name=`${i}号艇`,selected=(state.selectedBoats||[]).includes(name);
    rows+=`<g opacity="${selected?1:.5}"><text x="92" y="${y+28}" fill="#405367" font-size="25" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${selected?"★ ":""}${i}号艇</text><rect x="210" y="${y}" width="480" height="36" rx="18" fill="#edf1f5"/><rect x="210" y="${y}" width="${score*4.8}" height="36" rx="18" fill="${accent}"/><text x="720" y="${y+28}" fill="${dark}" font-size="25" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${score}</text><text x="790" y="${y+26}" fill="#687d91" font-size="18" font-weight="700" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.boatComments[i])}</text></g>`;
  }
  const character=state.characterImage?img(state.characterImage,815,1050,175,260,'opacity=".92"'):"";
  const main=state.edition==="previous"?`
    <rect x="60" y="430" width="960" height="230" rx="28" fill="#fff1f7" stroke="${accent}" stroke-width="3"/><text x="90" y="490" fill="${dark}" font-size="29" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">🌸 一果本命候補</text><text x="90" y="580" fill="#20364b" font-size="72" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.honmei)}</text><text x="470" y="555" fill="${accent}" font-size="48" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">イン逃げ ${clamp(state.nigeRate)}%</text><text x="470" y="605" fill="#53697d" font-size="24" font-weight="800" font-family="Arial,'Noto Sans JP',sans-serif">場平均との差 ${Number(state.upRate)>0?"+":""}${esc(state.upRate)} / 波乱 ${clamp(state.wave)}%</text>${stampOverlay(STAMPS[state.stamp]||"",780,430,190)}<rect x="60" y="690" width="960" height="450" rx="24" fill="#fff"/><text x="90" y="715" fill="${dark}" font-size="24" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">艇別展開評価（★ 注目艇）</text>${rows}<rect x="60" y="1170" width="960" height="165" rx="24" fill="#fff1f7"/>${textLines(state.mainComment,90,1220,{size:30,fill:dark,weight:900,max:3})}<text x="90" y="1315" fill="#a44270" font-size="22" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">危険艇：${esc(state.dangerBoat)}</text>${character}`:`
    <rect x="60" y="430" width="960" height="235" rx="28" fill="#fff1f7" stroke="${accent}" stroke-width="3"/><text x="90" y="485" fill="${dark}" font-size="28" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">🌸 展示終了！一果の最終決定</text><text x="90" y="555" fill="#20364b" font-size="56" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">展示 ${esc(state.tenjiRank)} / ${esc(state.tenjiTime)}</text><text x="90" y="615" fill="#53697d" font-size="27" font-weight="800" font-family="Arial,'Noto Sans JP',sans-serif">進入 ${esc(state.shinnyu)}　◎${esc(state.markMain)} ○${esc(state.markSecond)} ▲${esc(state.markThird)}</text>${stampOverlay(LIVE_STAMPS[state.liveStamp]||STAMPS[state.stamp]||"",795,435,175)}<rect x="60" y="700" width="960" height="250" rx="24" fill="#fff"/><text x="90" y="755" fill="${dark}" font-size="28" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">🌸 一果の買い目</text><text x="90" y="835" fill="#152c41" font-size="64" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.mainBet)}</text>${textLines(state.subBets,480,795,{size:25,fill:"#596f82",weight:800,max:4})}<text x="90" y="915" fill="${accent}" font-size="29" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">🎯 的中期待度 ${clamp(state.hitRate)}%</text><text x="650" y="915" fill="#a44270" font-size="22" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">展示急上昇：${esc(state.upBoat)}</text><rect x="60" y="980" width="960" height="330" rx="24" fill="#fff"/><text x="90" y="1035" fill="${dark}" font-size="27" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">🌸 一果の直前談</text>${textLines(state.liveComment,90,1090,{size:31,weight:900,max:3})}<text x="90" y="1210" fill="${dark}" font-size="24" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">⚙️ 機力チェック</text>${textLines(state.motorEval,90,1255,{size:24,fill:"#63798b",weight:700,max:2})}${character}`;
  return baseCanvas(header,`一果の${state.edition==="live"?"直前版":"前日版"}`,state,accent,dark,main);
}

function buildKiina(state){
  const accent="#ffcc00",dark="#101010",header=HEADERS.kiina[state.edition];
  const checked=Object.entries(state.checkItems).map(([label,on],i)=>`<text x="${90+(i%3)*290}" y="${1050+Math.floor(i/3)*48}" fill="${on?accent:"#8a8a8a"}" font-size="22" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${on?"☑":"☐"} ${esc(label)}</text>`).join("");
  const lanes=Array.from({length:6},(_,idx)=>{const i=idx+1,val=clamp(state.slit[i],-50,50),y=760+idx*42;return `<text x="92" y="${y+18}" fill="#ddd" font-size="18" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${i}号艇</text><rect x="190" y="${y}" width="650" height="26" rx="13" fill="${esc(state.laneBg)}"/><line x1="515" y1="${y-3}" x2="515" y2="${y+29}" stroke="${esc(state.slitLine)}" stroke-width="4"/><circle cx="${515+val*4}" cy="${y+13}" r="10" fill="${accent}"/>`;}).join("");
  const kstamp=KIINA_STAMPS[state.kiinaStamp]||"",character=state.characterImage?img(state.characterImage,815,1080,170,245,'opacity=".9"'):"";
  const main=`<rect x="60" y="430" width="960" height="235" rx="28" fill="#151515" stroke="${accent}" stroke-width="5"/><text x="90" y="490" fill="${accent}" font-size="30" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">⚡ キイナの穴党設定</text><text x="90" y="575" fill="#fff" font-size="64" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">5アタマ ${clamp(state.kiina5Rate)}%</text><text x="90" y="625" fill="${accent}" font-size="28" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.kiinaStars)}　${esc(state.anaTarget)}</text>${state.edition==="live"?stampOverlay(kstamp,790,440,175):stampOverlay(STAMPS[state.stamp]||"",790,440,175)}<rect x="60" y="700" width="960" height="300" rx="24" fill="${esc(state.slitBg)}"/><text x="90" y="742" fill="${accent}" font-size="26" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">⚡ スリット予想</text>${lanes}<rect x="60" y="1020" width="960" height="170" rx="24" fill="#171717"/><text x="90" y="1060" fill="${accent}" font-size="24" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">直前チェック項目</text>${checked}<rect x="60" y="1220" width="960" height="130" rx="24" fill="#fff8d9"/>${textLines(state.edition==="live"?`展示 ${state.tenjiRank} / ${state.tenjiTime}　進入 ${state.shinnyu}　4号艇差 ${state.diff4}`:state.warningMessage,90,1270,{size:28,fill:"#29220b",weight:900,max:3})}${character}`;
  return baseCanvas(header,`キイナの${state.edition==="live"?"直前版":"前日版"}`,state,accent,dark,main);
}

function buildHatsune(state){
  const accent=state.edition==="live"?"#d81b60":"#7e57c2",dark="#453369",header=HEADERS.hatsune[state.edition];
  const pickups=(state.pickups||[]).slice(0,clamp(state.pickupCount,1,6));
  const cards=pickups.map((p,i)=>{const col=i%2,row=Math.floor(i/2),x=70+col*480,y=740+row*180;return `<rect x="${x}" y="${y}" width="450" height="155" rx="20" fill="#fff" stroke="#e5d8f3" stroke-width="2"/>${p.image?img(p.image,x+18,y+18,115,115):`<circle cx="${x+75}" cy="${y+75}" r="55" fill="#eee6f8"/><text x="${x+75}" y="${y+86}" text-anchor="middle" fill="${accent}" font-size="46" font-family="Arial">👤</text>`}<text x="${x+150}" y="${y+48}" fill="${dark}" font-size="23" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(p.name)}</text>${textLines(p.comment,x+150,y+82,{size:17,fill:"#68758a",weight:700,max:3,line:1.35})}`;}).join("");
  const main=`<rect x="60" y="430" width="960" height="240" rx="28" fill="#f7f1ff" stroke="${accent}" stroke-width="3"/>${state.characterImage?img(state.characterImage,780,445,190,205):""}<text x="90" y="490" fill="${dark}" font-size="29" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">👗 初音の女子戦AI指数</text><text x="90" y="575" fill="#20364b" font-size="64" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.hatsuneHonmei)}</text><text x="430" y="552" fill="${accent}" font-size="36" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">近況 ${esc(state.hatsuneRhythm)}</text><text x="430" y="605" fill="#647287" font-size="27" font-weight="800" font-family="Arial,'Noto Sans JP',sans-serif">壁信頼度 ${esc(state.wallRank)} / ${esc(state.weightMemo)}</text>${stampOverlay(STAMPS[state.stamp]||"",820,450,145)}<text x="70" y="715" fill="${dark}" font-size="27" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">👗 初音の注目ピックアップ</text>${cards}<rect x="60" y="1270" width="960" height="100" rx="22" fill="#f7f1ff"/><text x="90" y="1328" fill="${accent}" font-size="28" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${state.edition==="live"?"💋 初音のヴィーナスアイ":"推奨買い目"}：${esc(state.hatsuneBet)}</text>`;
  return baseCanvas(header,`初音の${state.edition==="live"?"直前版":"前日版"}`,state,accent,dark,main);
}

function buildGrade(state){
  const rows=(state.gradeRows||[]).map((r,i)=>{const y=510+i*65,bg=i===11?"#fff2cb":i%2===0?"#fff":"#f8fafc";return `<rect x="55" y="${y}" width="970" height="62" fill="${bg}" stroke="#e7dfcf"/><text x="80" y="${y+39}" fill="#2f2c25" font-size="20" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(r.race)}</text><text x="150" y="${y+39}" fill="#7a5c1e" font-size="18" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(r.grade)}</text><text x="235" y="${y+39}" fill="#222" font-size="18" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(r.rank)}</text><text x="310" y="${y+39}" fill="#e04c87" font-size="18" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(r.ichika)}</text><text x="380" y="${y+39}" fill="#7e57c2" font-size="18" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(r.hatsune)}</text><text x="450" y="${y+39}" fill="#b48a00" font-size="18" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(r.kiina)}</text><text x="525" y="${y+39}" fill="#1f3347" font-size="18" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(r.main)}</text><text x="665" y="${y+39}" fill="#647284" font-size="16" font-weight="700" font-family="Arial,'Noto Sans JP',sans-serif">${esc(r.sub)}</text><text x="810" y="${y+39}" fill="${r.haran==="高"?"#d92d20":"#647284"}" font-size="16" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(r.haran)}</text><text x="875" y="${y+39}" fill="#647284" font-size="14" font-weight="700" font-family="Arial,'Noto Sans JP',sans-serif">${esc(r.memo)}</text>`;}).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1450" viewBox="0 0 1080 1450"><rect width="1080" height="1450" fill="#f4efe4"/>${img("/admin-newspaper/grade.jpg",40,40,1000,300)}<rect x="40" y="360" width="1000" height="100" rx="12" fill="#2e2417"/><text x="70" y="405" fill="#d5ad4d" font-size="21" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">BOATSTRIKERS GRADE SPECIAL</text><text x="70" y="445" fill="#fff" font-size="34" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.gradeTitle)}</text><text x="1010" y="420" text-anchor="end" fill="#fff" font-size="24" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.gradePlace)} / ${esc(state.gradeDate)}</text><text x="80" y="495" fill="#6c5733" font-size="17" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">R　種別　AI　一果　初音　キイナ　本線　押さえ　波乱　短評</text>${rows}<rect x="55" y="1320" width="970" height="80" rx="16" fill="#2e2417"/><text x="540" y="1371" text-anchor="middle" fill="#f0cc73" font-size="28" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.gradeHit)}</text></svg>`;
}

function buildSNS(state){const dangerous=state.snsMode==="危険",accent=dangerous?"#e63232":"#147bd1",title=dangerous?"危険レース警報":"鉄板候補";return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><rect width="1080" height="1350" fill="${dangerous?"#160d0d":"#eaf5ff"}"/><rect x="45" y="45" width="990" height="1260" rx="42" fill="${dangerous?"#251313":"#fff"}" stroke="${accent}" stroke-width="8"/><text x="80" y="125" fill="${accent}" font-size="34" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">BOAT STRIKE SNS</text><text x="80" y="220" fill="${dangerous?"#fff":"#17344f"}" font-size="76" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(title)}</text><text x="80" y="310" fill="${dangerous?"#fff":"#17344f"}" font-size="50" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.racePlace)} ${esc(state.raceNo)}</text><text x="1000" y="300" text-anchor="end" fill="${accent}" font-size="30" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">締切 ${esc(state.snsDeadline)}</text><circle cx="290" cy="535" r="175" fill="${accent}"/><text x="290" y="520" text-anchor="middle" fill="#fff" font-size="50" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${dangerous?"波乱度":"信頼度"}</text><text x="290" y="610" text-anchor="middle" fill="#fff" font-size="96" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${clamp(state.snsRate)}%</text><text x="590" y="470" fill="${dangerous?"#fff":"#17344f"}" font-size="28" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">本線</text><text x="590" y="545" fill="${accent}" font-size="68" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.snsMain)}</text><text x="590" y="610" fill="${dangerous?"#ddd":"#5f7488"}" font-size="27" font-weight="800" font-family="Arial,'Noto Sans JP',sans-serif">軸 ${esc(state.snsAxis)}</text><rect x="80" y="760" width="920" height="390" rx="30" fill="${dangerous?"#351b1b":"#f2f8fd"}"/>${[state.snsStep1,state.snsStep2,state.snsStep3].map((t,i)=>`<circle cx="135" cy="${845+i*100}" r="30" fill="${accent}"/><text x="135" y="${856+i*100}" text-anchor="middle" fill="#fff" font-size="24" font-weight="900" font-family="Arial">0${i+1}</text><text x="195" y="${856+i*100}" fill="${dangerous?"#fff":"#29445c"}" font-size="31" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(t)}</text>`).join("")}<text x="540" y="1245" text-anchor="middle" fill="${dangerous?"#aaa":"#7a8fa1"}" font-size="23" font-weight="800" font-family="Arial,'Noto Sans JP',sans-serif">BOATSTRIKERS / 1マーク展開イメージ</text></svg>`;}
function buildSticker(state){const frame=STICKER_FRAMES[state.frameType]||STICKER_FRAMES["鉄板"];return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080"><rect width="1080" height="1080" fill="#111"/>${img(frame,0,0,1080,1080)}<rect x="90" y="90" width="900" height="900" rx="55" fill="rgba(0,0,0,.18)"/><text x="120" y="180" fill="#fff" font-size="38" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.racePlace)} ${esc(state.raceNo)}</text><text x="540" y="465" text-anchor="middle" fill="#fff" font-size="180" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.stickerMain)}</text><text x="540" y="555" text-anchor="middle" fill="#fff" font-size="46" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.stickerSub)}</text><text x="540" y="720" text-anchor="middle" fill="#fff" font-size="72" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.stickerBet)}</text><text x="540" y="835" text-anchor="middle" fill="#fff" font-size="34" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.stickerMemo)}</text></svg>`;}
function buildSvg(state){if(state.mode==="ichika")return buildIchika(state);if(state.mode==="kiina")return buildKiina(state);if(state.mode==="hatsune")return buildHatsune(state);if(state.mode==="grade")return buildGrade(state);if(state.mode==="sns")return buildSNS(state);return buildSticker(state);}
function Field({label,children,wide=false}){return <label className={`${styles.field} ${wide?styles.wideField:""}`}><span>{label}</span>{children}</label>;}
function Section({title,children}){return <section className={styles.formSection}><h3>{title}</h3><div className={styles.formGrid}>{children}</div></section>;}
async function fileToDataUrl(file){return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||""));reader.onerror=reject;reader.readAsDataURL(file);});}

export default function NewspaperAdminClient(){
  const [form,setForm]=useState(initial);const [message,setMessage]=useState("");
  useEffect(()=>{try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return;const p=JSON.parse(raw);setForm(prev=>({...prev,...p,boatScores:{...prev.boatScores,...(p.boatScores||{})},boatComments:{...prev.boatComments,...(p.boatComments||{})},checkItems:{...prev.checkItems,...(p.checkItems||{})},slit:{...prev.slit,...(p.slit||{})},selectedBoats:Array.isArray(p.selectedBoats)?p.selectedBoats:prev.selectedBoats,pickups:Array.isArray(p.pickups)?p.pickups:prev.pickups,gradeRows:Array.isArray(p.gradeRows)?p.gradeRows:prev.gradeRows}));}catch{}},[]);
  const svg=useMemo(()=>buildSvg(form),[form]);
  function set(name,value){setForm(p=>({...p,[name]:value}));setMessage("");}
  function setObj(name,key,value){setForm(p=>({...p,[name]:{...(p[name]||{}),[key]:value}}));setMessage("");}
  function setArray(name,index,patcher){setForm(p=>{const a=[...(p[name]||[])];a[index]={...a[index],...patcher};return {...p,[name]:a};});setMessage("");}
  function toggleSelectedBoat(v){setForm(p=>({...p,selectedBoats:p.selectedBoats.includes(v)?p.selectedBoats.filter(x=>x!==v):[...p.selectedBoats,v]}));setMessage("");}
  function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(form));setMessage("下書きをこの端末に保存しました。");}catch{setMessage("画像が大きいため下書きを保存できませんでした。画像以外は入力内容を保持しています。");}}
  function reset(){if(!confirm("Phase 2の入力内容を初期化しますか？"))return;localStorage.removeItem(STORAGE_KEY);setForm({...initial,raceDate:todayJst(),gradeDate:todayJst()});setMessage("初期化しました。");}
  async function uploadMain(e){const f=e.target.files?.[0];if(!f)return;set("characterImage",await fileToDataUrl(f));}
  async function uploadBg(e){const f=e.target.files?.[0];if(!f)return;set("backgroundImage",await fileToDataUrl(f));}
  async function uploadPickup(index,e){const f=e.target.files?.[0];if(!f)return;setArray("pickups",index,{image:await fileToDataUrl(f)});}
  function downloadPng(){const blob=new Blob([svg],{type:"image/svg+xml;charset=utf-8"});const url=URL.createObjectURL(blob);const image=new Image();image.onload=()=>{const vb=svg.match(/viewBox="0 0 (\d+) (\d+)"/);const w=Number(vb?.[1]||1080),h=Number(vb?.[2]||1500);const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;canvas.getContext("2d").drawImage(image,0,0,w,h);URL.revokeObjectURL(url);const a=document.createElement("a");a.download=`${form.raceDate}_${form.racePlace}_${form.raceNo}_${form.mode}_${form.edition}.png`;a.href=canvas.toDataURL("image/png");a.click();};image.onerror=()=>{URL.revokeObjectURL(url);alert("PNG生成に失敗しました。");};image.src=url;}
  const newspaperMode=["ichika","kiina","hatsune"].includes(form.mode);

  return <main className={styles.page}><div className={styles.shell}>
    <header className={styles.hero}><div><span>BOATSTRIKERS CMS / STREAMLIT COMPATIBLE</span><h1>新聞・SNS画像作成</h1><p>Streamlit版と同じ画像資産・入力項目を使いながら、右側のライブプレビューを見て編集できます。</p></div><div className={styles.heroButtons}><Link href="/admin">← 管理画面</Link><button onClick={save}>下書き保存</button></div></header>
    <nav className={styles.personaTabs}>{MODES.map(([key,icon,label])=><button key={key} className={form.mode===key?styles.activePersona:""} onClick={()=>set("mode",key)}><b>{icon}</b><span>{label}</span></button>)}</nav>
    {newspaperMode&&<div className={styles.editionTabs}><button className={form.edition==="previous"?styles.activeEdition:""} onClick={()=>set("edition","previous")}>📰 前日版</button><button className={form.edition==="live"?styles.activeEdition:""} onClick={()=>set("edition","live")}>⚡ 直前版</button></div>}
    <div className={styles.workspace}><div className={styles.editor}>
      <Section title="📌 レース基本情報"><Field label="日付"><input type="date" value={form.raceDate} onChange={e=>set("raceDate",e.target.value)}/></Field><Field label="レース場"><select value={form.racePlace} onChange={e=>set("racePlace",e.target.value)}>{COURSE_NAMES.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="レース番号"><select value={form.raceNo} onChange={e=>set("raceNo",e.target.value)}>{Array.from({length:12},(_,i)=><option key={i+1}>{i+1}R</option>)}</select></Field>{newspaperMode&&<Field label="スタンプ"><select value={form.stamp} onChange={e=>set("stamp",e.target.value)}>{Object.keys(STAMPS).map(v=><option key={v}>{v}</option>)}</select></Field>}</Section>
      {newspaperMode&&<Section title="📌 画像"><Field label="キャラ画像"><input type="file" accept="image/*" onChange={uploadMain}/></Field><Field label="背景画像"><input type="file" accept="image/*" onChange={uploadBg}/></Field></Section>}

      {form.mode==="ichika"&&<><Section title="📌 一果本命候補"><Field label="本命"><select value={form.honmei} onChange={e=>set("honmei",e.target.value)}>{BOATS.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="イン逃げ期待度"><input type="range" min="0" max="100" value={form.nigeRate} onChange={e=>set("nigeRate",Number(e.target.value))}/><output>{form.nigeRate}%</output></Field><Field label="場平均との差"><input type="range" min="-30" max="30" value={form.upRate} onChange={e=>set("upRate",Number(e.target.value))}/><output>{form.upRate}</output></Field><Field label="波乱指数"><input type="range" min="0" max="100" value={form.wave} onChange={e=>set("wave",Number(e.target.value))}/><output>{form.wave}%</output></Field><Field label="危険艇"><select value={form.dangerBoat} onChange={e=>set("dangerBoat",e.target.value)}><option>なし</option>{BOATS.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="一果のひとこと" wide><textarea value={form.mainComment} onChange={e=>set("mainComment",e.target.value)}/></Field></Section>
      <Section title="📌 一果展開評価"><div className={styles.wideField}><span style={{display:"block",fontSize:11,fontWeight:900,color:"#60788c",marginBottom:7}}>注目艇</span><div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{BOATS.map(v=><button type="button" key={v} onClick={()=>toggleSelectedBoat(v)} style={{border:"1px solid #d5e2ec",borderRadius:10,padding:"9px 11px",fontWeight:900,cursor:"pointer",background:form.selectedBoats.includes(v)?"#168dcc":"#fff",color:form.selectedBoats.includes(v)?"#fff":"#17344f"}}>{v}</button>)}</div></div>{Array.from({length:6},(_,idx)=>idx+1).map(i=><Field key={i} label={`${i}号艇 コメント / 評価`}><input value={form.boatComments[i]} onChange={e=>setObj("boatComments",i,e.target.value)}/><input type="range" min="0" max="100" value={form.boatScores[i]} onChange={e=>setObj("boatScores",i,Number(e.target.value))}/><output>{form.boatScores[i]}</output></Field>)}</Section>
      {form.edition==="live"&&<Section title="📌 一果直前"><Field label="展示評価"><select value={form.tenjiRank} onChange={e=>set("tenjiRank",e.target.value)}>{["S","A","B","C"].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="補正タイム"><input value={form.tenjiTime} onChange={e=>set("tenjiTime",e.target.value)}/></Field><Field label="進入予想"><input value={form.shinnyu} onChange={e=>set("shinnyu",e.target.value)}/></Field><Field label="本命買い目"><input value={form.mainBet} onChange={e=>set("mainBet",e.target.value)}/></Field><Field label="押さえ買い目"><textarea value={form.subBets} onChange={e=>set("subBets",e.target.value)}/></Field><Field label="展示急上昇"><select value={form.upBoat} onChange={e=>set("upBoat",e.target.value)}><option>なし</option>{BOATS.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="🎯 的中期待度"><input type="range" min="0" max="100" value={form.hitRate} onChange={e=>set("hitRate",Number(e.target.value))}/><output>{form.hitRate}%</output></Field><Field label="◎ 本命"><select value={form.markMain} onChange={e=>set("markMain",e.target.value)}>{[1,2,3,4,5,6].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="○ 対抗"><select value={form.markSecond} onChange={e=>set("markSecond",e.target.value)}>{[1,2,3,4,5,6].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="▲ 単穴"><select value={form.markThird} onChange={e=>set("markThird",e.target.value)}>{[1,2,3,4,5,6].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="表示するスタンプ"><select value={form.liveStamp} onChange={e=>set("liveStamp",e.target.value)}>{Object.keys(LIVE_STAMPS).map(v=><option key={v}>{v}</option>)}</select></Field><Field label="機力チェック" wide><textarea value={form.motorEval} onChange={e=>set("motorEval",e.target.value)}/></Field><Field label="直前コメント" wide><textarea value={form.liveComment} onChange={e=>set("liveComment",e.target.value)}/></Field></Section>}</>}

      {form.mode==="kiina"&&<><Section title="⚡ キイナの穴党設定"><Field label="5アタマ期待度"><input type="range" min="0" max="100" value={form.kiina5Rate} onChange={e=>set("kiina5Rate",Number(e.target.value))}/><output>{form.kiina5Rate}%</output></Field><Field label="超抜気配"><select value={form.kiinaStars} onChange={e=>set("kiinaStars",e.target.value)}>{["★","★★","★★★","★★★★","★★★★★"].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="穴ターゲット"><input value={form.anaTarget} onChange={e=>set("anaTarget",e.target.value)}/></Field><Field label="警報メッセージ" wide><textarea value={form.warningMessage} onChange={e=>set("warningMessage",e.target.value)}/></Field>{form.edition==="live"&&<Field label="LIVEスタンプ"><select value={form.kiinaStamp} onChange={e=>set("kiinaStamp",e.target.value)}>{Object.keys(KIINA_STAMPS).map(v=><option key={v}>{v}</option>)}</select></Field>}</Section><Section title="⚡ キイナのスリット予想">{Array.from({length:6},(_,idx)=>idx+1).map(i=><Field label={`${i}号艇 スリット`} key={i}><input type="range" min="-50" max="50" step="5" value={form.slit[i]} onChange={e=>setObj("slit",i,Number(e.target.value))}/><output>{form.slit[i]}</output></Field>)}</Section><Section title="🎨 スリットのデザイン設定"><Field label="スリット全体の背景色"><input type="color" value={form.slitBg} onChange={e=>set("slitBg",e.target.value)}/></Field><Field label="レーンの色"><input type="color" value={form.laneBg} onChange={e=>set("laneBg",e.target.value)}/></Field><Field label="スリットラインの色"><input type="color" value={form.slitLine} onChange={e=>set("slitLine",e.target.value)}/></Field></Section><Section title="⚡ 直前チェック項目">{Object.entries(form.checkItems).map(([k,v])=><label className={styles.checkField} key={k}><input type="checkbox" checked={v} onChange={e=>setObj("checkItems",k,e.target.checked)}/><span>{k}</span></label>)}{form.edition==="live"&&<><Field label="展示評価"><select value={form.tenjiRank} onChange={e=>set("tenjiRank",e.target.value)}>{["S","A","B","C"].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="補正タイム"><input value={form.tenjiTime} onChange={e=>set("tenjiTime",e.target.value)}/></Field><Field label="進入予想"><input value={form.shinnyu} onChange={e=>set("shinnyu",e.target.value)}/></Field><Field label="4号艇との展示差"><input value={form.diff4} onChange={e=>set("diff4",e.target.value)}/></Field></>}</Section></>}

      {form.mode==="hatsune"&&<><Section title="👗 初音の女子戦設定"><Field label="本命ヴィーナス"><select value={form.hatsuneHonmei} onChange={e=>set("hatsuneHonmei",e.target.value)}>{BOATS.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="近況リズム"><select value={form.hatsuneRhythm} onChange={e=>set("hatsuneRhythm",e.target.value)}>{["不調","並","好調","絶好調","神掛かり"].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="壁信頼度"><select value={form.wallRank} onChange={e=>set("wallRank",e.target.value)}>{["SS","S","A","B","C"].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="推奨買い目"><input value={form.hatsuneBet} onChange={e=>set("hatsuneBet",e.target.value)}/></Field><Field label="調整メモ"><input value={form.weightMemo} onChange={e=>set("weightMemo",e.target.value)}/></Field></Section><Section title="👗 初音の女子戦・ピックアップ設定"><Field label="ピックアップ人数"><input type="number" min="1" max="6" value={form.pickupCount} onChange={e=>set("pickupCount",clamp(e.target.value,1,6))}/></Field>{(form.pickups||[]).slice(0,form.pickupCount).map((p,i)=><div className={styles.pickupEditor} key={i}><b>選手 {i+1}</b><input value={p.name} onChange={e=>setArray("pickups",i,{name:e.target.value})}/><input type="file" accept="image/*" onChange={e=>uploadPickup(i,e)}/><textarea value={p.comment} onChange={e=>setArray("pickups",i,{comment:e.target.value})}/></div>)}</Section></>}

      {form.mode==="grade"&&<><Section title="🏆 12R新聞 共通情報"><Field label="タイトル"><input value={form.gradeTitle} onChange={e=>set("gradeTitle",e.target.value)}/></Field><Field label="日付"><input type="date" value={form.gradeDate} onChange={e=>set("gradeDate",e.target.value)}/></Field><Field label="場"><select value={form.gradePlace} onChange={e=>set("gradePlace",e.target.value)}>{COURSE_NAMES.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="見出し"><input value={form.gradeHit} onChange={e=>set("gradeHit",e.target.value)}/></Field></Section><Section title="🏆 12R入力">{(form.gradeRows||[]).map((r,i)=><div className={styles.gradeRowEditor} key={i}><b>{r.race}</b><select value={r.grade} onChange={e=>setArray("gradeRows",i,{grade:e.target.value})}><option>通常</option><option>勝負</option><option>見</option></select><select value={r.rank} onChange={e=>setArray("gradeRows",i,{rank:e.target.value})}>{["SS","S","A","B","C"].map(v=><option key={v}>{v}</option>)}</select><input value={r.ichika} onChange={e=>setArray("gradeRows",i,{ichika:e.target.value})} placeholder="一果"/><input value={r.hatsune} onChange={e=>setArray("gradeRows",i,{hatsune:e.target.value})} placeholder="初音"/><input value={r.kiina} onChange={e=>setArray("gradeRows",i,{kiina:e.target.value})} placeholder="キイナ"/><input value={r.main} onChange={e=>setArray("gradeRows",i,{main:e.target.value})} placeholder="本線"/><input value={r.sub} onChange={e=>setArray("gradeRows",i,{sub:e.target.value})} placeholder="押さえ"/><select value={r.haran} onChange={e=>setArray("gradeRows",i,{haran:e.target.value})}><option>低</option><option>中</option><option>高</option></select><input value={r.memo} onChange={e=>setArray("gradeRows",i,{memo:e.target.value})} placeholder="短評"/></div>)}</Section></>}
      {form.mode==="sns"&&<Section title="📱 SNS画像ツール"><Field label="画像タイプ"><select value={form.snsMode} onChange={e=>set("snsMode",e.target.value)}><option>危険</option><option>鉄板</option></select></Field><Field label="締切"><input value={form.snsDeadline} onChange={e=>set("snsDeadline",e.target.value)}/></Field><Field label="成功率 / 信頼度"><input type="range" min="0" max="100" value={form.snsRate} onChange={e=>set("snsRate",Number(e.target.value))}/><output>{form.snsRate}%</output></Field><Field label="本線予想"><input value={form.snsMain} onChange={e=>set("snsMain",e.target.value)}/></Field><Field label="展開①"><input value={form.snsStep1} onChange={e=>set("snsStep1",e.target.value)}/></Field><Field label="展開②"><input value={form.snsStep2} onChange={e=>set("snsStep2",e.target.value)}/></Field><Field label="展開③"><input value={form.snsStep3} onChange={e=>set("snsStep3",e.target.value)}/></Field><Field label="軸選手"><select value={form.snsAxis} onChange={e=>set("snsAxis",e.target.value)}>{BOATS.map(v=><option key={v}>{v}</option>)}</select></Field></Section>}
      {form.mode==="sticker"&&<Section title="✨ 速報ステッカー"><Field label="フレーム"><select value={form.frameType} onChange={e=>set("frameType",e.target.value)}>{Object.keys(STICKER_FRAMES).map(v=><option key={v}>{v}</option>)}</select></Field><Field label="メイン表示"><input value={form.stickerMain} onChange={e=>set("stickerMain",e.target.value)}/></Field><Field label="サブ表示"><input value={form.stickerSub} onChange={e=>set("stickerSub",e.target.value)}/></Field><Field label="買い目"><input value={form.stickerBet} onChange={e=>set("stickerBet",e.target.value)}/></Field><Field label="メモ" wide><input value={form.stickerMemo} onChange={e=>set("stickerMemo",e.target.value)}/></Field></Section>}
      <div className={styles.editorActions}><button className={styles.saveButton} onClick={save}>💾 下書き保存</button><button className={styles.resetButton} onClick={reset}>初期化</button></div>{message&&<p className={styles.savedMessage}>{message}</p>}
    </div><aside className={styles.previewPane}><div className={styles.previewHeader}><div><span>STREAMLIT COMPATIBLE PREVIEW</span><strong>{MODES.find(v=>v[0]===form.mode)?.[1]} {MODES.find(v=>v[0]===form.mode)?.[2]} {newspaperMode?`・${form.edition==="live"?"直前版":"前日版"}`:""}</strong></div><button onClick={downloadPng}>PNG保存</button></div><div className={styles.svgPreview} dangerouslySetInnerHTML={{__html:svg}}/><p className={styles.previewNote}>Streamlit版と同じ画像資産を使用。入力内容は右側へリアルタイム反映されます。</p></aside></div>
  </div></main>;
}
