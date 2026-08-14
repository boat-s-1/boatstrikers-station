"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./newspaperAdmin.module.css";

const STORAGE_KEY = "boatstrikers:newspaper-phase1";

const PERSONAS = {
  ichika: {
    label: "一果",
    icon: "🌸",
    color: "#e94687",
    dark: "#8f2458",
    pale: "#fff1f7",
    previousHeader: "/admin-newspaper/ichika-previous.png",
    liveHeader: "/admin-newspaper/ichika-live.png",
  },
  hatsune: {
    label: "初音",
    icon: "👗",
    color: "#7857c8",
    dark: "#4b358f",
    pale: "#f5f0ff",
    previousHeader: "/admin-newspaper/hatsune-previous.jpg",
    liveHeader: "/admin-newspaper/hatsune-live.jpg",
  },
  kiina: {
    label: "キイナ",
    icon: "⚡",
    color: "#f5b400",
    dark: "#221b00",
    pale: "#fff8db",
    previousHeader: "/admin-newspaper/kiina-previous.jpg",
    liveHeader: "/admin-newspaper/kiina-live.jpg",
  },
  grade: {
    label: "12R特別紙",
    icon: "🏆",
    color: "#c89221",
    dark: "#38270b",
    pale: "#fff8e8",
    previousHeader: "/admin-newspaper/grade.jpg",
    liveHeader: "/admin-newspaper/grade.jpg",
  },
};

function todayJst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const initialState = {
  persona: "ichika",
  edition: "previous",
  raceDate: todayJst(),
  racePlace: "丸亀",
  raceNo: "1R",

  honmei: "1号艇",
  stamp: "本命",
  nigeRate: 84,
  upRate: 11,
  wave: 28,
  dangerBoat: "なし",
  mainComment: "1号艇中心だが2号艇の差し注意！",
  attentionBoats: ["1号艇", "2号艇", "3号艇"],
  boatScores: {
    "1号艇": 82,
    "2号艇": 67,
    "3号艇": 58,
    "4号艇": 48,
    "5号艇": 44,
    "6号艇": 36,
  },
  boatComments: {
    "1号艇": "インから先マイできる足。",
    "2号艇": "差し残しに注意。",
    "3号艇": "握って攻める展開なら連圏。",
    "4号艇": "展開待ち。",
    "5号艇": "まくり差しの余地あり。",
    "6号艇": "大外で展開待ち。",
  },

  tenjiRank: "S",
  tenjiTime: "6.71",
  shinnyu: "123/456",
  mainBet: "1-2-3",
  subBets: "1-3-2\n1-2-5",
  upBoat: "なし",
  hitRate: 80,
  markMain: "1",
  markSecond: "2",
  markThird: "5",
  motorEval: "1号艇は出足型、3号艇の伸びが良好。",
  liveComment: "展示は1号艇優勢！",

  kiina5Rate: 72,
  kiinaStars: "★★★★★",
  anaTarget: "5号艇のまくり差し",
  warningMessage: "波乱警報発令中！万舟のチャンス！",
  kiinaDiff4: "-0.05",
  slit: {
    "1号艇": 0,
    "2号艇": 0,
    "3号艇": 0,
    "4号艇": 0,
    "5号艇": 0,
    "6号艇": 0,
  },

  hatsuneHonmei: "1号艇",
  hatsuneRhythm: "好調",
  wallRank: "A",
  hatsuneBet: "1-23-4",
  hatsuneMemo: "チルト0.5",
  hatsunePickup: "1号艇：近況リズム良好\n4号艇：展開ひとつで連圏",

  gradeTitle: "Gレース 12R FINAL",
  gradeHeadline: "勝負レースをデータで厳選",
};

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function multilineText(value, x, y, options = {}) {
  const {
    fontSize = 28,
    fill = "#27384b",
    weight = 700,
    lineHeight = 1.45,
    maxLines = 4,
    anchor = "start",
  } = options;
  const lines = String(value || "")
    .split(/\r?\n/)
    .slice(0, maxLines);

  return `<text x="${x}" y="${y}" fill="${fill}" font-size="${fontSize}" font-weight="${weight}" text-anchor="${anchor}" font-family="Arial,'Noto Sans JP',sans-serif">${lines
    .map(
      (line, index) =>
        `<tspan x="${x}" dy="${index === 0 ? 0 : fontSize * lineHeight}">${esc(
          line
        )}</tspan>`
    )
    .join("")}</text>`;
}

function scoreBars(state, color) {
  const boats = Object.keys(state.boatScores || {});
  return boats
    .map((boat, index) => {
      const score = clampNumber(state.boatScores?.[boat], 0, 100);
      const y = 655 + index * 62;
      const boatNo = Number(boat.replace(/\D/g, "")) || index + 1;
      const boatColors = ["#f5f5f5", "#333", "#e53d3d", "#2877e8", "#e6b315", "#2da052"];
      const textColor = boatNo === 1 ? "#333" : "#fff";
      return `
        <text x="92" y="${y + 25}" fill="#516478" font-size="25" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(boat)}</text>
        <rect x="205" y="${y}" width="500" height="34" rx="17" fill="#edf1f5"/>
        <rect x="205" y="${y}" width="${score * 5}" height="34" rx="17" fill="${boatColors[index] || color}"/>
        <text x="725" y="${y + 26}" fill="${color}" font-size="25" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${score}</text>
      `;
    })
    .join("");
}

function buildSvg(state) {
  const persona = PERSONAS[state.persona] || PERSONAS.ichika;
  const header =
    state.edition === "live" ? persona.liveHeader : persona.previousHeader;
  const live = state.edition === "live";
  const W = 1080;
  const H = 1350;

  const title =
    state.persona === "grade"
      ? state.gradeTitle
      : `${persona.icon} ${persona.label}の${live ? "直前版" : "前日版"}`;

  let specialBlock = "";

  if (state.persona === "ichika") {
    specialBlock = live
      ? `
        <rect x="60" y="455" width="960" height="205" rx="28" fill="${persona.pale}" stroke="${persona.color}" stroke-width="3"/>
        <text x="90" y="510" fill="${persona.dark}" font-size="30" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">直前チェック</text>
        <text x="90" y="570" fill="#20364b" font-size="54" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">展示 ${esc(state.tenjiRank)}　補正 ${esc(state.tenjiTime)}</text>
        <text x="90" y="625" fill="#52697d" font-size="28" font-weight="800" font-family="Arial,'Noto Sans JP',sans-serif">進入 ${esc(state.shinnyu)}　◎${esc(state.markMain)} ○${esc(state.markSecond)} ▲${esc(state.markThird)}</text>
      `
      : `
        <rect x="60" y="455" width="960" height="180" rx="28" fill="${persona.pale}" stroke="${persona.color}" stroke-width="3"/>
        <text x="90" y="510" fill="${persona.dark}" font-size="30" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">一果 本命候補</text>
        <text x="90" y="585" fill="#20364b" font-size="64" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.honmei)}</text>
        <text x="470" y="575" fill="${persona.color}" font-size="52" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">イン逃げ ${clampNumber(state.nigeRate,0,100)}%</text>
      `;
  } else if (state.persona === "kiina") {
    specialBlock = `
      <rect x="60" y="455" width="960" height="205" rx="28" fill="#151515" stroke="${persona.color}" stroke-width="5"/>
      <text x="90" y="510" fill="${persona.color}" font-size="30" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">穴党チェック</text>
      <text x="90" y="580" fill="#fff" font-size="58" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">5アタマ ${clampNumber(state.kiina5Rate,0,100)}%</text>
      <text x="90" y="628" fill="${persona.color}" font-size="28" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.kiinaStars)}　${esc(state.anaTarget)}</text>
    `;
  } else if (state.persona === "hatsune") {
    specialBlock = `
      <rect x="60" y="455" width="960" height="205" rx="28" fill="${persona.pale}" stroke="${persona.color}" stroke-width="3"/>
      <text x="90" y="510" fill="${persona.dark}" font-size="30" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">女子戦 PICK UP</text>
      <text x="90" y="578" fill="#20364b" font-size="58" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.hatsuneHonmei)}</text>
      <text x="480" y="565" fill="${persona.color}" font-size="38" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">近況 ${esc(state.hatsuneRhythm)}　壁 ${esc(state.wallRank)}</text>
      <text x="90" y="625" fill="#53687b" font-size="26" font-weight="800" font-family="Arial,'Noto Sans JP',sans-serif">推奨 ${esc(state.hatsuneBet)}　${esc(state.hatsuneMemo)}</text>
    `;
  } else {
    specialBlock = `
      <rect x="60" y="455" width="960" height="205" rx="28" fill="${persona.pale}" stroke="${persona.color}" stroke-width="4"/>
      <text x="90" y="520" fill="${persona.dark}" font-size="35" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.gradeHeadline)}</text>
      <text x="90" y="600" fill="#20364b" font-size="60" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.racePlace)} ${esc(state.raceNo)}</text>
    `;
  }

  const lower =
    state.persona === "ichika"
      ? live
        ? `
          <rect x="60" y="700" width="960" height="210" rx="24" fill="#fff"/>
          <text x="90" y="755" fill="${persona.dark}" font-size="30" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">推奨買い目</text>
          <text x="90" y="830" fill="#142a3e" font-size="58" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.mainBet)}</text>
          ${multilineText(state.subBets, 440, 790, {fontSize: 26, fill:"#5b6f80", weight:800, maxLines:3})}
          <text x="90" y="885" fill="${persona.color}" font-size="27" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">的中期待度 ${clampNumber(state.hitRate,0,100)}%</text>
          <rect x="60" y="940" width="960" height="270" rx="24" fill="#fff"/>
          <text x="90" y="995" fill="${persona.dark}" font-size="28" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">直前コメント</text>
          ${multilineText(state.liveComment, 90, 1050, {fontSize:30, maxLines:3})}
          ${multilineText(state.motorEval, 90, 1160, {fontSize:24, fill:"#687c8d", weight:700, maxLines:2})}
        `
        : `
          <rect x="60" y="680" width="960" height="465" rx="24" fill="#fff"/>
          <text x="90" y="735" fill="${persona.dark}" font-size="30" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">艇別評価</text>
          ${scoreBars(state, persona.color)}
          <rect x="60" y="1175" width="960" height="105" rx="24" fill="${persona.pale}"/>
          ${multilineText(state.mainComment, 90, 1220, {fontSize:28, fill:persona.dark, weight:900, maxLines:2})}
        `
      : state.persona === "kiina"
      ? `
        <rect x="60" y="700" width="960" height="220" rx="24" fill="#fff"/>
        <text x="90" y="755" fill="#222" font-size="29" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${live ? "直前LIVE" : "波乱警報"}</text>
        ${multilineText(live ? `展示 ${state.tenjiRank} / ${state.tenjiTime}　進入 ${state.shinnyu}` : state.warningMessage, 90, 815, {fontSize:31, fill:"#333", weight:900, maxLines:3})}
        <rect x="60" y="960" width="960" height="250" rx="24" fill="#111"/>
        <text x="90" y="1015" fill="${persona.color}" font-size="28" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">スリット予想</text>
        ${Object.entries(state.slit || {}).map(([boat,val],i)=>`
          <text x="100" y="${1065+i*24}" fill="#ddd" font-size="18" font-weight="800" font-family="Arial,'Noto Sans JP',sans-serif">${esc(boat)}</text>
          <rect x="220" y="${1050+i*24}" width="520" height="10" rx="5" fill="#333"/>
          <rect x="${480 + clampNumber(val,-50,50)*4}" y="${1046+i*24}" width="10" height="18" rx="4" fill="${persona.color}"/>
        `).join("")}
      `
      : state.persona === "hatsune"
      ? `
        <rect x="60" y="700" width="960" height="300" rx="24" fill="#fff"/>
        <text x="90" y="755" fill="${persona.dark}" font-size="29" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">女子戦メモ</text>
        ${multilineText(state.hatsunePickup, 90, 820, {fontSize:29, fill:"#35485d", weight:800, maxLines:5})}
        <rect x="60" y="1040" width="960" height="170" rx="24" fill="${persona.pale}"/>
        ${multilineText(live ? state.liveComment : state.mainComment, 90, 1100, {fontSize:30, fill:persona.dark, weight:900, maxLines:3})}
      `
      : `
        <rect x="60" y="700" width="960" height="450" rx="24" fill="#fff"/>
        <text x="90" y="765" fill="${persona.dark}" font-size="30" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">FINAL PICK</text>
        <text x="90" y="850" fill="#142a3e" font-size="72" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.mainBet)}</text>
        ${multilineText(state.mainComment, 90, 930, {fontSize:31, fill:"#53687b", weight:800, maxLines:4})}
      `;

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#f4f7fb"/>
    <rect x="35" y="35" width="1010" height="1280" rx="35" fill="#ffffff" stroke="${persona.color}" stroke-width="5"/>
    <image href="${esc(header)}" x="60" y="60" width="960" height="190" preserveAspectRatio="xMidYMid slice"/>
    <rect x="60" y="265" width="960" height="150" rx="24" fill="${persona.dark}"/>
    <text x="90" y="315" fill="${persona.color}" font-size="24" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${live ? "LIVE / JUST BEFORE" : "PRE-RACE EDITION"}</text>
    <text x="90" y="370" fill="#fff" font-size="45" font-weight="900" font-family="Arial,'Noto Sans JP',sans-serif">${esc(title)}</text>
    <text x="980" y="315" fill="#fff" font-size="24" font-weight="800" text-anchor="end" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.raceDate)}</text>
    <text x="980" y="375" fill="#fff" font-size="42" font-weight="900" text-anchor="end" font-family="Arial,'Noto Sans JP',sans-serif">${esc(state.racePlace)} ${esc(state.raceNo)}</text>
    ${specialBlock}
    ${lower}
    <text x="540" y="1290" fill="#7890a5" font-size="20" font-weight="800" text-anchor="middle" font-family="Arial,'Noto Sans JP',sans-serif">BOATSTRIKERS / GENERATED FROM ADMIN NEWSPAPER</text>
  </svg>`;
}

function Field({ label, children, hint }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function Section({ title, children }) {
  return (
    <section className={styles.formSection}>
      <h3>{title}</h3>
      <div className={styles.formGrid}>{children}</div>
    </section>
  );
}

export default function NewspaperAdminClient() {
  const [form, setForm] = useState(initialState);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setForm((prev) => ({
        ...prev,
        ...parsed,
        boatScores: { ...prev.boatScores, ...(parsed.boatScores || {}) },
        boatComments: { ...prev.boatComments, ...(parsed.boatComments || {}) },
        slit: { ...prev.slit, ...(parsed.slit || {}) },
      }));
    } catch {}
  }, []);

  const svg = useMemo(() => buildSvg(form), [form]);
  const persona = PERSONAS[form.persona] || PERSONAS.ichika;

  function set(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
    setSavedMessage("");
  }

  function updateObject(name, key, value) {
    setForm((prev) => ({
      ...prev,
      [name]: { ...(prev[name] || {}), [key]: value },
    }));
    setSavedMessage("");
  }

  function saveDraft() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    setSavedMessage("下書きをこの端末に保存しました。");
  }

  function resetDraft() {
    if (!window.confirm("入力内容を初期状態に戻しますか？")) return;
    window.localStorage.removeItem(STORAGE_KEY);
    setForm({ ...initialState, raceDate: todayJst() });
    setSavedMessage("入力内容を初期化しました。");
  }

  async function downloadPng() {
    try {
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const image = new Image();

      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1080;
        canvas.height = 1350;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0);
        URL.revokeObjectURL(url);

        const link = document.createElement("a");
        const safePlace = String(form.racePlace || "race").replace(/[\\/:*?"<>|]/g, "");
        link.download = `${form.raceDate}_${safePlace}_${form.raceNo}_${form.persona}_${form.edition}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
        alert("画像生成に失敗しました。プレビュー画像をスクリーンショットしてください。");
      };

      image.src = url;
    } catch {
      alert("画像生成に失敗しました。");
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <span>BOATSTRIKERS CMS / NEWSPAPER</span>
            <h1>新聞・画像作成</h1>
            <p>
              Streamlit版の主要入力を管理画面へ移植した第一弾です。
              入力しながら右側でリアルタイムに確認できます。
            </p>
          </div>
          <div className={styles.heroButtons}>
            <Link href="/admin">← 管理画面</Link>
            <button type="button" onClick={saveDraft}>下書き保存</button>
          </div>
        </header>

        <nav className={styles.personaTabs}>
          {Object.entries(PERSONAS).map(([key, item]) => (
            <button
              type="button"
              key={key}
              className={form.persona === key ? styles.activePersona : ""}
              onClick={() => set("persona", key)}
            >
              <b>{item.icon}</b>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className={styles.editionTabs}>
          <button
            type="button"
            className={form.edition === "previous" ? styles.activeEdition : ""}
            onClick={() => set("edition", "previous")}
          >
            📰 前日版
          </button>
          <button
            type="button"
            className={form.edition === "live" ? styles.activeEdition : ""}
            onClick={() => set("edition", "live")}
          >
            ⚡ 直前版
          </button>
        </div>

        <div className={styles.workspace}>
          <div className={styles.editor}>
            <Section title="レース基本情報">
              <Field label="日付">
                <input type="date" value={form.raceDate} onChange={(e) => set("raceDate", e.target.value)} />
              </Field>
              <Field label="レース場">
                <input value={form.racePlace} onChange={(e) => set("racePlace", e.target.value)} />
              </Field>
              <Field label="レース番号">
                <select value={form.raceNo} onChange={(e) => set("raceNo", e.target.value)}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option value={`${i + 1}R`} key={i + 1}>{i + 1}R</option>
                  ))}
                </select>
              </Field>
            </Section>

            {form.persona === "ichika" && (
              <>
                <Section title="🌸 一果・基本評価">
                  <Field label="本命">
                    <select value={form.honmei} onChange={(e) => set("honmei", e.target.value)}>
                      {Array.from({ length: 6 }, (_, i) => (
                        <option value={`${i + 1}号艇`} key={i + 1}>{i + 1}号艇</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="イン逃げ期待度">
                    <input type="range" min="0" max="100" value={form.nigeRate} onChange={(e) => set("nigeRate", Number(e.target.value))} />
                    <output>{form.nigeRate}%</output>
                  </Field>
                  <Field label="波乱指数">
                    <input type="range" min="0" max="100" value={form.wave} onChange={(e) => set("wave", Number(e.target.value))} />
                    <output>{form.wave}%</output>
                  </Field>
                  <Field label="一果のひとこと">
                    <textarea value={form.mainComment} onChange={(e) => set("mainComment", e.target.value)} />
                  </Field>
                </Section>

                {!form.edition.includes("live") && (
                  <Section title="艇別評価">
                    {Array.from({ length: 6 }, (_, i) => `${i + 1}号艇`).map((boat) => (
                      <Field label={`${boat} 評価`} key={boat}>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={form.boatScores[boat]}
                          onChange={(e) => updateObject("boatScores", boat, Number(e.target.value))}
                        />
                        <output>{form.boatScores[boat]}</output>
                      </Field>
                    ))}
                  </Section>
                )}

                {form.edition === "live" && (
                  <Section title="直前情報">
                    <Field label="展示評価">
                      <select value={form.tenjiRank} onChange={(e) => set("tenjiRank", e.target.value)}>
                        {["S", "A", "B", "C"].map((v) => <option key={v}>{v}</option>)}
                      </select>
                    </Field>
                    <Field label="補正展示タイム">
                      <input value={form.tenjiTime} onChange={(e) => set("tenjiTime", e.target.value)} />
                    </Field>
                    <Field label="進入予想">
                      <input value={form.shinnyu} onChange={(e) => set("shinnyu", e.target.value)} />
                    </Field>
                    <Field label="本命買い目">
                      <input value={form.mainBet} onChange={(e) => set("mainBet", e.target.value)} />
                    </Field>
                    <Field label="押さえ買い目">
                      <textarea value={form.subBets} onChange={(e) => set("subBets", e.target.value)} />
                    </Field>
                    <Field label="的中期待度">
                      <input type="range" min="0" max="100" value={form.hitRate} onChange={(e) => set("hitRate", Number(e.target.value))} />
                      <output>{form.hitRate}%</output>
                    </Field>
                    <Field label="直前コメント">
                      <textarea value={form.liveComment} onChange={(e) => set("liveComment", e.target.value)} />
                    </Field>
                    <Field label="機力チェック">
                      <textarea value={form.motorEval} onChange={(e) => set("motorEval", e.target.value)} />
                    </Field>
                  </Section>
                )}
              </>
            )}

            {form.persona === "kiina" && (
              <>
                <Section title="⚡ キイナ・穴党設定">
                  <Field label="5アタマ期待度">
                    <input type="range" min="0" max="100" value={form.kiina5Rate} onChange={(e) => set("kiina5Rate", Number(e.target.value))} />
                    <output>{form.kiina5Rate}%</output>
                  </Field>
                  <Field label="超抜気配">
                    <select value={form.kiinaStars} onChange={(e) => set("kiinaStars", e.target.value)}>
                      {["★","★★","★★★","★★★★","★★★★★"].map((v) => <option key={v}>{v}</option>)}
                    </select>
                  </Field>
                  <Field label="穴ターゲット">
                    <input value={form.anaTarget} onChange={(e) => set("anaTarget", e.target.value)} />
                  </Field>
                  <Field label="警報メッセージ">
                    <textarea value={form.warningMessage} onChange={(e) => set("warningMessage", e.target.value)} />
                  </Field>
                </Section>

                <Section title="スリット予想">
                  {Array.from({ length: 6 }, (_, i) => `${i + 1}号艇`).map((boat) => (
                    <Field label={`${boat} スリット`} key={boat}>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        step="5"
                        value={form.slit[boat]}
                        onChange={(e) => updateObject("slit", boat, Number(e.target.value))}
                      />
                      <output>{form.slit[boat]}</output>
                    </Field>
                  ))}
                </Section>

                {form.edition === "live" && (
                  <Section title="直前LIVE">
                    <Field label="展示評価">
                      <select value={form.tenjiRank} onChange={(e) => set("tenjiRank", e.target.value)}>
                        {["S", "A", "B", "C"].map((v) => <option key={v}>{v}</option>)}
                      </select>
                    </Field>
                    <Field label="補正タイム">
                      <input value={form.tenjiTime} onChange={(e) => set("tenjiTime", e.target.value)} />
                    </Field>
                    <Field label="進入予想">
                      <input value={form.shinnyu} onChange={(e) => set("shinnyu", e.target.value)} />
                    </Field>
                    <Field label="4号艇との展示差">
                      <input value={form.kiinaDiff4} onChange={(e) => set("kiinaDiff4", e.target.value)} />
                    </Field>
                  </Section>
                )}
              </>
            )}

            {form.persona === "hatsune" && (
              <Section title="👗 初音・女子戦設定">
                <Field label="本命ヴィーナス">
                  <select value={form.hatsuneHonmei} onChange={(e) => set("hatsuneHonmei", e.target.value)}>
                    {Array.from({ length: 6 }, (_, i) => (
                      <option value={`${i + 1}号艇`} key={i + 1}>{i + 1}号艇</option>
                    ))}
                  </select>
                </Field>
                <Field label="近況リズム">
                  <select value={form.hatsuneRhythm} onChange={(e) => set("hatsuneRhythm", e.target.value)}>
                    {["不調","並","好調","絶好調","神掛かり"].map((v) => <option key={v}>{v}</option>)}
                  </select>
                </Field>
                <Field label="壁信頼度">
                  <select value={form.wallRank} onChange={(e) => set("wallRank", e.target.value)}>
                    {["SS","S","A","B","C"].map((v) => <option key={v}>{v}</option>)}
                  </select>
                </Field>
                <Field label="推奨買い目">
                  <input value={form.hatsuneBet} onChange={(e) => set("hatsuneBet", e.target.value)} />
                </Field>
                <Field label="調整メモ">
                  <input value={form.hatsuneMemo} onChange={(e) => set("hatsuneMemo", e.target.value)} />
                </Field>
                <Field label="ピックアップメモ">
                  <textarea value={form.hatsunePickup} onChange={(e) => set("hatsunePickup", e.target.value)} />
                </Field>
                <Field label={form.edition === "live" ? "直前コメント" : "初音のひとこと"}>
                  <textarea value={form.edition === "live" ? form.liveComment : form.mainComment} onChange={(e) => set(form.edition === "live" ? "liveComment" : "mainComment", e.target.value)} />
                </Field>
              </Section>
            )}

            {form.persona === "grade" && (
              <Section title="🏆 12R特別紙">
                <Field label="タイトル">
                  <input value={form.gradeTitle} onChange={(e) => set("gradeTitle", e.target.value)} />
                </Field>
                <Field label="見出し">
                  <input value={form.gradeHeadline} onChange={(e) => set("gradeHeadline", e.target.value)} />
                </Field>
                <Field label="本線">
                  <input value={form.mainBet} onChange={(e) => set("mainBet", e.target.value)} />
                </Field>
                <Field label="コメント">
                  <textarea value={form.mainComment} onChange={(e) => set("mainComment", e.target.value)} />
                </Field>
              </Section>
            )}

            <div className={styles.editorActions}>
              <button type="button" className={styles.saveButton} onClick={saveDraft}>
                💾 下書き保存
              </button>
              <button type="button" className={styles.resetButton} onClick={resetDraft}>
                入力を初期化
              </button>
            </div>

            {savedMessage && <p className={styles.savedMessage}>{savedMessage}</p>}
          </div>

          <aside className={styles.previewPane}>
            <div className={styles.previewHeader}>
              <div>
                <span>LIVE PREVIEW</span>
                <strong>{persona.icon} {persona.label}・{form.edition === "live" ? "直前版" : "前日版"}</strong>
              </div>
              <button type="button" onClick={downloadPng}>
                PNG保存
              </button>
            </div>

            <div
              className={styles.svgPreview}
              dangerouslySetInnerHTML={{ __html: svg }}
            />

            <p className={styles.previewNote}>
              ※第一弾では主要項目と画像保存を移植しています。
              元Streamlit版の細かなスタンプ・顔写真差し替え・全新聞レイアウトは次段階で追加できます。
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
