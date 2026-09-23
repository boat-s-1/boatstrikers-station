"use client";

import { useEffect, useState } from "react";

const COPY_VARIATIONS = {
  ichika: {
    label: "一果",
    mainAngles: [
      "1号艇のイン逃げ成立条件",
      "1号艇の信頼材料",
      "スタート比較から見るイン優位",
      "1マークまでの展開",
      "相手候補との力関係",
      "進入とインの守りやすさ",
      "展示・気配から見るイン評価",
      "艇別評価の差",
      "数字に表れた安定材料",
      "イン逃げを脅かす注意材料",
    ],
    bubbleAngles: [
      "相手選びで注目したい点",
      "スタートで気になる艇",
      "展示と本番を分けて見たい点",
      "2・3着候補の見どころ",
      "攻め艇への警戒ポイント",
      "進入変化があった場合の見どころ",
      "入力数値から読み取れる補足",
      "慎重に確認したいポイント",
      "展開が分かれるポイント",
      "本命以外で押さえて見たい材料",
    ],
    voice: "冷静で研究熱心。やさしく親しみやすい一果の口調。イン逃げ・1号艇を軸に、断定しすぎず観察ポイントを伝える。",
  },
  hatsune: {
    label: "初音",
    mainAngles: [
      "女子戦の中心艇と展開",
      "内枠勢の主導権",
      "注目艇同士の比較",
      "展示・気配の良さ",
      "スタート比較",
      "1マークの展開ポイント",
      "本命艇と相手候補の関係",
      "艇別評価の差",
      "注目選手・注目艇の強み",
      "波乱につながる注意材料",
    ],
    bubbleAngles: [
      "相手候補で気になる艇",
      "展開で見逃したくない点",
      "スタートで注目したい点",
      "展示から感じる補足ポイント",
      "内外の比較で気になる点",
      "2・3着争いの見どころ",
      "入力数値から読み取れる一言",
      "慎重に確認したい材料",
      "本命以外の注目ポイント",
      "レース直前に見たいポイント",
    ],
    voice: "明るくやわらかく親しみやすい初音の口調。女子戦の展開や注目艇を楽しみながら見る雰囲気で、煽りすぎない。",
  },
  kiina: {
    label: "キイナ",
    mainAngles: [
      "穴候補が浮上する条件",
      "5号艇を含む外枠の攻め筋",
      "本命が崩れる展開材料",
      "波乱につながる艇別評価差",
      "スタートから生まれる穴展開",
      "1マークの展開のズレ",
      "展示・気配から見える穴材料",
      "内枠と外枠の力関係",
      "人気どころ以外の注目材料",
      "波乱度を高める注意点",
    ],
    bubbleAngles: [
      "穴候補で一番気になる材料",
      "外から攻める艇への注目",
      "インが崩れるならどこを見るか",
      "スタートで波乱につながる点",
      "展示で拾いたい変化",
      "2・3着に入り込む穴の余地",
      "入力数値から見える波乱要素",
      "狙いすぎず確認したい点",
      "展開ひとつで変わるポイント",
      "本命以外で面白い観察ポイント",
    ],
    voice: "元気で少し攻めた穴党のキイナらしい口調。ワクワク感は出すが、的中保証・過度な煽り・根拠のない断定はしない。",
  },
};

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function readCurrentForm() {
  const root = document.querySelector("main");
  if (!root) return { mode: "新聞", edition: "", sections: [] };

  const activeMode = root.querySelector('nav button[class*="activePersona"]');
  const activeEdition = root.querySelector('div[class*="editionTabs"] button[class*="activeEdition"]');
  const mode = cleanText(activeMode?.innerText) || "新聞";
  const edition = cleanText(activeEdition?.innerText) || "";

  const sections = [];
  root.querySelectorAll('div[class*="formSection"]').forEach((section) => {
    const title = cleanText(section.querySelector("h3")?.innerText) || "設定";
    const rows = [];

    section.querySelectorAll("input, select, textarea").forEach((el) => {
      if (el.type === "hidden") return;

      let label = "";
      const field = el.closest('label, div[class*="field"], div[class*="pickupEditor"], div[class*="gradeRowEditor"]');
      if (field) {
        const directLabel = field.querySelector(':scope > span, :scope > b');
        label = cleanText(directLabel?.innerText);
      }
      if (!label) label = cleanText(el.getAttribute("aria-label") || el.name || el.placeholder || "入力項目");

      let value = "";
      if (el.type === "checkbox") value = el.checked ? "ON" : "OFF";
      else if (el.type === "file") value = el.files?.length ? `画像選択済み（${el.files[0].name}）` : "未選択";
      else value = cleanText(el.value);

      if (value !== "") rows.push(`${label}：${value}`);
    });

    if (rows.length) sections.push({ title, rows });
  });

  return { mode, edition, sections };
}

function getCharacterKey(mode) {
  if (mode.includes("一果")) return "ichika";
  if (mode.includes("初音")) return "hatsune";
  if (mode.includes("キイナ")) return "kiina";
  return null;
}

function pickNonRepeating(characterKey, kind, options) {
  if (!options?.length) return "";
  if (typeof window === "undefined") return options[0];

  const storageKey = `boatstrikers:newspaper-copy:${characterKey}:${kind}`;
  const previous = Number.parseInt(window.localStorage.getItem(storageKey) || "-1", 10);
  const candidates = options.map((_, index) => index).filter((index) => index !== previous);
  const pool = candidates.length ? candidates : options.map((_, index) => index);
  const nextIndex = pool[Math.floor(Math.random() * pool.length)];
  window.localStorage.setItem(storageKey, String(nextIndex));
  return options[nextIndex];
}

function buildDynamicCopyRules(data) {
  const characterKey = getCharacterKey(data.mode);
  if (!characterKey) return "";

  const config = COPY_VARIATIONS[characterKey];
  const mainAngle = pickNonRepeating(characterKey, "main", config.mainAngles);
  const bubbleAngle = pickNonRepeating(characterKey, "bubble", config.bubbleAngles);

  return `\n\n【今回の可変コピー指定】\n・この新聞では、メインコピーと吹き出しコメントを今回の入力データから新しく作成する。\n・今回のメインコピーの切り口：${mainAngle}\n・今回の吹き出しコメントの切り口：${bubbleAngle}\n・キャラクター口調：${config.voice}\n\n【メインコピー】\n・今回の入力データに根拠がある内容だけを使い、15文字前後を目安に短く強くまとめる。\n・過去の定型文や入力コメントをそのまま丸写しせず、このレース専用の自然なコピーに言い換える。\n・今回指定した切り口に該当する入力情報がない場合は、存在する入力情報の中から最も近い事実へ切り替える。情報を推測・補完しない。\n・的中保証、確定表現、過度な煽りは使わない。\n\n【吹き出しコメント】\n・20〜35文字程度。${config.label}本人が話しているような自然な一言にする。\n・メインコピーとは別の事実・観点を使い、メインコピーの言い換えや同義反復にしない。\n・同じ語尾や決まり文句を機械的に繰り返さない。\n・今回指定した切り口に該当する入力情報がない場合は、存在する入力情報の中から別の事実へ切り替える。情報を推測・補完しない。\n・買い煽り、的中保証、断定的な勝利表現は使わない。\n\n【可変コピーの最重要ルール】\n・「入力内容から再生成」を押すたびに今回の切り口を更新し、直前と同じ切り口を連続使用しない。\n・メインコピーと吹き出しコメントは必ず異なる文章にする。\n・場名、レース番号、艇番、数値、選手情報などの事実は上記入力だけを使用する。\n・AI v2、shadow、model、raw、scoreなど内部用モデル名・内部指標名は画像に表示しない。\n・[object Object]を絶対に表示しない。`;
}

function buildPrompt() {
  const data = readCurrentForm();
  const detail = data.sections
    .map((section) => `【${section.title}】\n${section.rows.join("\n")}`)
    .join("\n\n");
  const dynamicCopyRules = buildDynamicCopyRules(data);

  return `【BoatStrikers 画像作成プロンプト】\n\n対象：${data.mode}${data.edition ? ` / ${data.edition}` : ""}\n\n${detail}${dynamicCopyRules}\n\n【画像生成ルール】\n・現在のBoatStrikers新聞／SNS画像／速報ステッカーの完成済みデザインを基準にする。\n・既存のキャラクター、背景、配色、ロゴ、装飾、フレーム、全体レイアウトは変更しない。\n・上記の入力データに該当する文字・数値・選択内容だけを正確に反映する。\n・日本語文字を崩さず、誤字・文字化けを起こさない。\n・文字は各枠内に収め、はみ出す場合は自然に文字サイズや改行を調整する。\n・艇番、レース場、R数、時刻、％、買い目などの数字を最優先で正確に表示する。\n・入力されていない情報を勝手に追加しない。\n・元画像に存在する要素は、変更指示がない限り削除・移動・変更しない。\n・完成画像としてそのまま公開できる品質で仕上げる。`;
}

export default function NewspaperPromptAssistant() {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const generate = () => {
    setPrompt(buildPrompt());
    setCopied(false);
    setOpen(true);
  };

  const copy = async () => {
    const next = prompt || buildPrompt();
    if (!prompt) setPrompt(next);
    try {
      await navigator.clipboard.writeText(next);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const area = document.createElement("textarea");
      area.value = next;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <>
      <button className="newspaperPromptFab" onClick={generate} type="button">
        ✨ 画像プロンプト
      </button>

      {open && (
        <div className="newspaperPromptBackdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <section className="newspaperPromptPanel" aria-label="画像作成プロンプト">
            <header>
              <div>
                <span>BOATSTRIKERS AI ASSIST</span>
                <h2>画像作成プロンプト</h2>
                <p>現在入力している内容を自動で読み取りました。</p>
              </div>
              <button className="newspaperPromptClose" onClick={() => setOpen(false)} type="button">×</button>
            </header>

            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} spellCheck={false} />

            <div className="newspaperPromptActions">
              <button className="newspaperPromptRefresh" onClick={() => setPrompt(buildPrompt())} type="button">↻ 入力内容から再生成</button>
              <button className="newspaperPromptCopy" onClick={copy} type="button">{copied ? "✓ コピーしました" : "📋 プロンプトをコピー"}</button>
            </div>
          </section>
        </div>
      )}

      <style jsx global>{`
        .newspaperPromptFab {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 80;
          min-height: 52px;
          padding: 0 20px;
          border: 0;
          border-radius: 999px;
          color: #fff;
          background: linear-gradient(135deg,#6d43d9,#168dcc);
          box-shadow: 0 12px 32px rgba(45,74,160,.28);
          font-size: 14px;
          font-weight: 950;
          cursor: pointer;
        }
        .newspaperPromptBackdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          justify-content: flex-end;
          background: rgba(11,31,48,.46);
          backdrop-filter: blur(3px);
        }
        .newspaperPromptPanel {
          width: min(680px, 92vw);
          height: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 22px;
          background: #f8fbff;
          box-shadow: -18px 0 48px rgba(17,45,68,.18);
        }
        .newspaperPromptPanel header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
        }
        .newspaperPromptPanel header span {
          color: #168dcc;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: .12em;
        }
        .newspaperPromptPanel h2 { margin: 4px 0 5px; color:#17344f; font-size: 24px; }
        .newspaperPromptPanel p { margin:0; color:#71889b; font-size:12px; }
        .newspaperPromptClose {
          width: 42px;
          height: 42px;
          border: 1px solid #dbe7ef;
          border-radius: 12px;
          color:#60788c;
          background:#fff;
          font-size:24px;
          cursor:pointer;
        }
        .newspaperPromptPanel textarea {
          flex: 1;
          width: 100%;
          min-height: 320px;
          box-sizing: border-box;
          resize: none;
          border: 1px solid #cfe0eb;
          border-radius: 16px;
          padding: 16px;
          color:#17344f;
          background:#fff;
          font: 13px/1.75 ui-monospace,SFMono-Regular,Menlo,monospace;
          outline: none;
        }
        .newspaperPromptActions { display:grid; grid-template-columns:1fr 1.35fr; gap:10px; }
        .newspaperPromptActions button {
          min-height: 50px;
          border-radius: 13px;
          font-size: 13px;
          font-weight: 950;
          cursor:pointer;
        }
        .newspaperPromptRefresh { border:1px solid #d4e3ed; color:#49697f; background:#fff; }
        .newspaperPromptCopy { border:0; color:#fff; background:#168dcc; }
        @media (max-width:620px) {
          .newspaperPromptFab { right:12px; bottom:12px; min-height:48px; padding:0 16px; }
          .newspaperPromptPanel { width:100vw; padding:14px; }
          .newspaperPromptActions { grid-template-columns:1fr; }
        }
      `}</style>
    </>
  );
}
