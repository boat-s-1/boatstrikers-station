"use client";

import { useEffect, useState } from "react";

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

function buildPrompt() {
  const data = readCurrentForm();
  const detail = data.sections
    .map((section) => `【${section.title}】\n${section.rows.join("\n")}`)
    .join("\n\n");

  return `【BoatStrikers 画像作成プロンプト】\n\n対象：${data.mode}${data.edition ? ` / ${data.edition}` : ""}\n\n${detail}\n\n【画像生成ルール】\n・現在のBoatStrikers新聞／SNS画像／速報ステッカーの完成済みデザインを基準にする。\n・既存のキャラクター、背景、配色、ロゴ、装飾、フレーム、全体レイアウトは変更しない。\n・上記の入力データに該当する文字・数値・選択内容だけを正確に反映する。\n・日本語文字を崩さず、誤字・文字化けを起こさない。\n・文字は各枠内に収め、はみ出す場合は自然に文字サイズや改行を調整する。\n・艇番、レース場、R数、時刻、％、買い目などの数字を最優先で正確に表示する。\n・入力されていない情報を勝手に追加しない。\n・元画像に存在する要素は、変更指示がない限り削除・移動・変更しない。\n・完成画像としてそのまま公開できる品質で仕上げる。`;
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
