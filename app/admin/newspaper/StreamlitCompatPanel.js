"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "boatstrikers:newspaper-phase2";
const boats = Array.from({ length: 6 }, (_, i) => `${i + 1}号艇`);
const stampOptions = ["なし", "波乱注意", "鉄板", "見"];

function readDraft() {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}

export default function StreamlitCompatPanel() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    selectedBoats: ["1号艇", "2号艇", "3号艇"],
    upBoat: "なし",
    markMain: "1",
    markSecond: "2",
    markThird: "5",
    liveStamp: "なし",
    backgroundImage: "",
    characterImage: "",
  });
  const [saved, setSaved] = useState("");

  useEffect(() => {
    const p = readDraft();
    setDraft((d) => ({
      ...d,
      selectedBoats: Array.isArray(p.selectedBoats) ? p.selectedBoats : d.selectedBoats,
      upBoat: p.upBoat ?? d.upBoat,
      markMain: p.markMain ?? d.markMain,
      markSecond: p.markSecond ?? d.markSecond,
      markThird: p.markThird ?? d.markThird,
      liveStamp: p.liveStamp ?? d.liveStamp,
      backgroundImage: p.backgroundImage ?? "",
      characterImage: p.characterImage ?? "",
    }));
  }, []);

  function set(name, value) { setDraft((p) => ({ ...p, [name]: value })); setSaved(""); }
  function toggleBoat(boat) {
    setDraft((p) => ({
      ...p,
      selectedBoats: p.selectedBoats.includes(boat)
        ? p.selectedBoats.filter((v) => v !== boat)
        : [...p.selectedBoats, boat],
    }));
    setSaved("");
  }
  function fileToDataUrl(file, key) {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => set(key, String(r.result || ""));
    r.readAsDataURL(file);
  }
  function apply() {
    const current = readDraft();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...draft }));
    setSaved("Streamlit互換設定を保存しました。プレビューへ反映します。");
    setTimeout(() => window.location.reload(), 250);
  }

  return <>
    <button
      type="button"
      onClick={() => setOpen(true)}
      style={{position:"fixed",left:18,bottom:18,zIndex:90,border:0,borderRadius:16,padding:"13px 16px",background:"#172554",color:"#fff",fontWeight:900,boxShadow:"0 10px 28px rgba(15,23,42,.24)",cursor:"pointer"}}
    >⚙️ Streamlit互換設定</button>

    {open && <div style={{position:"fixed",inset:0,zIndex:100,background:"rgba(15,23,42,.55)",display:"grid",placeItems:"center",padding:14}} onMouseDown={(e)=>{if(e.target===e.currentTarget)setOpen(false)}}>
      <div style={{width:"min(720px,100%)",maxHeight:"88vh",overflow:"auto",background:"#fff",borderRadius:22,padding:20,boxShadow:"0 24px 70px rgba(0,0,0,.28)"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start"}}>
          <div><div style={{fontSize:12,fontWeight:900,color:"#2563eb"}}>STREAMLIT COMPATIBILITY</div><h2 style={{margin:"4px 0 6px"}}>Streamlit版と同じ追加入力</h2><p style={{margin:0,color:"#64748b",fontSize:13,lineHeight:1.6}}>元Streamlit版にあり、Web版で不足していた項目を補完します。</p></div>
          <button onClick={()=>setOpen(false)} style={{border:0,background:"#f1f5f9",borderRadius:10,width:38,height:38,cursor:"pointer"}}>×</button>
        </div>

        <section style={{marginTop:18,padding:15,border:"1px solid #e2e8f0",borderRadius:16}}>
          <b>📌 画像</b>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,marginTop:12}}>
            <label style={{fontSize:12,fontWeight:800}}>キャラ画像<input style={{display:"block",marginTop:7,width:"100%"}} type="file" accept="image/*" onChange={e=>fileToDataUrl(e.target.files?.[0],"characterImage")}/></label>
            <label style={{fontSize:12,fontWeight:800}}>背景画像<input style={{display:"block",marginTop:7,width:"100%"}} type="file" accept="image/*" onChange={e=>fileToDataUrl(e.target.files?.[0],"backgroundImage")}/></label>
          </div>
        </section>

        <section style={{marginTop:12,padding:15,border:"1px solid #e2e8f0",borderRadius:16}}>
          <b>📌 一果展開評価</b>
          <div style={{marginTop:10,fontSize:12,fontWeight:800,color:"#475569"}}>注目艇</div>
          <div style={{display:"flex",gap:7,flexWrap:"wrap",marginTop:8}}>{boats.map(b=><button key={b} type="button" onClick={()=>toggleBoat(b)} style={{border:"1px solid #cbd5e1",borderRadius:10,padding:"9px 11px",fontWeight:800,cursor:"pointer",background:draft.selectedBoats.includes(b)?"#2563eb":"#fff",color:draft.selectedBoats.includes(b)?"#fff":"#334155"}}>{b}</button>)}</div>
        </section>

        <section style={{marginTop:12,padding:15,border:"1px solid #e2e8f0",borderRadius:16}}>
          <b>📌 一果直前</b>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginTop:12}}>
            <label style={{fontSize:12,fontWeight:800}}>展示急上昇<select value={draft.upBoat} onChange={e=>set("upBoat",e.target.value)} style={{display:"block",width:"100%",marginTop:6,minHeight:42,border:"1px solid #cbd5e1",borderRadius:10,padding:8}}><option>なし</option>{boats.map(b=><option key={b}>{b}</option>)}</select></label>
            <label style={{fontSize:12,fontWeight:800}}>◎ 本命<select value={draft.markMain} onChange={e=>set("markMain",e.target.value)} style={{display:"block",width:"100%",marginTop:6,minHeight:42,border:"1px solid #cbd5e1",borderRadius:10,padding:8}}>{[1,2,3,4,5,6].map(v=><option key={v}>{v}</option>)}</select></label>
            <label style={{fontSize:12,fontWeight:800}}>○ 対抗<select value={draft.markSecond} onChange={e=>set("markSecond",e.target.value)} style={{display:"block",width:"100%",marginTop:6,minHeight:42,border:"1px solid #cbd5e1",borderRadius:10,padding:8}}>{[1,2,3,4,5,6].map(v=><option key={v}>{v}</option>)}</select></label>
            <label style={{fontSize:12,fontWeight:800}}>▲ 単穴<select value={draft.markThird} onChange={e=>set("markThird",e.target.value)} style={{display:"block",width:"100%",marginTop:6,minHeight:42,border:"1px solid #cbd5e1",borderRadius:10,padding:8}}>{[1,2,3,4,5,6].map(v=><option key={v}>{v}</option>)}</select></label>
            <label style={{fontSize:12,fontWeight:800}}>表示するスタンプ<select value={draft.liveStamp} onChange={e=>set("liveStamp",e.target.value)} style={{display:"block",width:"100%",marginTop:6,minHeight:42,border:"1px solid #cbd5e1",borderRadius:10,padding:8}}>{stampOptions.map(v=><option key={v}>{v}</option>)}</select></label>
          </div>
        </section>

        {saved && <div style={{marginTop:12,padding:11,borderRadius:11,background:"#ecfdf3",color:"#047857",fontSize:12,fontWeight:800}}>{saved}</div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:9,marginTop:16}}>
          <button onClick={apply} style={{minHeight:48,border:0,borderRadius:13,background:"#2563eb",color:"#fff",fontWeight:900,cursor:"pointer"}}>この設定をプレビューへ反映</button>
          <button onClick={()=>setOpen(false)} style={{minHeight:48,border:"1px solid #cbd5e1",borderRadius:13,background:"#fff",padding:"0 16px",fontWeight:800,cursor:"pointer"}}>閉じる</button>
        </div>
      </div>
    </div>}
  </>;
}
