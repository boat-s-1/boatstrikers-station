"use client";

import { useEffect, useState } from "react";

const COPY_INDEX_KEY = "boatstrikers:newspaper-copy-index";

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
      if (field) label = cleanText(field.querySelector(':scope > span, :scope > b')?.innerText);
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

function allRows(data) {
  return data.sections.flatMap((section) => section.rows);
}

function findValue(data, keywords, fallback = "") {
  const row = allRows(data).find((line) => keywords.some((keyword) => line.includes(keyword)));
  if (!row) return fallback;
  return cleanText(row.split("：").slice(1).join("：")) || fallback;
}

function getCharacterKey(mode) {
  if (mode.includes("一果")) return "ichika";
  if (mode.includes("初音")) return "hatsune";
  if (mode.includes("キイナ")) return "kiina";
  return null;
}

function nextIndex(characterKey, length) {
  if (typeof window === "undefined" || !length) return 0;
  let history = {};
  try { history = JSON.parse(window.localStorage.getItem(COPY_INDEX_KEY) || "{}"); } catch {}
  const previous = Number.isInteger(history[characterKey]) ? history[characterKey] : -1;
  let next = Math.floor(Math.random() * length);
  if (length > 1 && next === previous) next = (next + 1) % length;
  history[characterKey] = next;
  try { window.localStorage.setItem(COPY_INDEX_KEY, JSON.stringify(history)); } catch {}
  return next;
}

function makeCopy(data) {
  const key = getCharacterKey(data.mode);
  if (!key) return null;

  const place = findValue(data, ["場名", "レース場", "開催場"], "");
  const raceNo = findValue(data, ["レース", "R数"], "");
  const honmei = findValue(data, ["本命", "本命候補", "本命艇"], "1号艇");
  const nigeRate = findValue(data, ["イン逃げ", "逃げ率"], "");
  const wave = findValue(data, ["波乱", "波乱度"], "");
  const danger = findValue(data, ["危険艇"], "");
  const mainComment = findValue(data, ["メインコメント", "一言", "コメント"], "");
  const anaTarget = findValue(data, ["穴対象", "穴狙い", "注目穴"], "");
  const fiveRate = findValue(data, ["5アタマ", "5頭", "5号艇"], "");
  const rhythm = findValue(data, ["リズム"], "");
  const wallRank = findValue(data, ["壁評価", "壁ランク"], "");
  const liveComment = findValue(data, ["展示コメント", "展示気配", "直前コメント"], "");

  const location = [place, raceNo].filter(Boolean).join(" ");

  const variants = {
    ichika: [
      {
        main: nigeRate ? `${honmei}、イン逃げ${nigeRate}に注目` : `${honmei}のイン戦を軸にチェック`,
        bubble: danger && danger !== "なし" ? `${danger}の動きには少し注意して見たいね` : `相手選びまで丁寧に見ていこう`,
      },
      {
        main: wave ? `イン中心、波乱${wave}も確認` : `${honmei}中心に展開を整理`,
        bubble: mainComment || `数字だけで決めず、1マークまで見たいね`,
      },
      {
        main: liveComment ? `展示からイン戦を再確認` : `${location || "このレース"}は内の攻防に注目`,
        bubble: liveComment || `相手候補の差し・攻め筋も忘れずに`,
      },
      {
        main: nigeRate ? `逃げ期待${nigeRate}、相手がカギ` : `インの信頼度と相手関係を比較`,
        bubble: danger && danger !== "なし" ? `危険艇${danger}まで含めて組み立てたいね` : `2・3着候補の並びも大事だよ`,
      },
    ],
    hatsune: [
      {
        main: `${honmei}を中心に女子戦をチェック`,
        bubble: rhythm ? `リズムは${rhythm}。ここは流れも見たいな♪` : `相手候補までやさしく見比べていこう♪`,
      },
      {
        main: wallRank ? `壁評価${wallRank}、内の攻防に注目` : `内枠勢の主導権がポイント`,
        bubble: mainComment || `1マークの隊形で印象が変わりそうだね`,
      },
      {
        main: liveComment ? `展示気配から最終チェック` : `${location || "この女子戦"}の流れを見極めたい`,
        bubble: liveComment || `本命だけじゃなく相手の動きも見たいな♪`,
      },
      {
        main: `${honmei}と相手候補の比較がカギ`,
        bubble: rhythm ? `${rhythm}の流れをレースでもつなげられるか注目♪` : `スタートからの並びをしっかり見よう♪`,
      },
    ],
    kiina: [
      {
        main: anaTarget ? `穴の狙い目は${anaTarget}` : `本命以外の攻め筋をチェック`,
        bubble: fiveRate ? `5アタマ${fiveRate}、外からの一撃も見たい！` : `人気だけで決めるのはまだ早いよ！`,
      },
      {
        main: wave ? `波乱${wave}、穴の入り口を探す` : `荒れるなら1マークが勝負どころ`,
        bubble: danger && danger !== "なし" ? `${danger}が崩す展開なら面白い！` : `外の攻めが入る形を見逃さないで！`,
      },
      {
        main: liveComment ? `展示から穴候補を再点検` : `${location || "このレース"}は外の動きに注目`,
        bubble: liveComment || `差し場ができれば穴の出番もあるよ！`,
      },
      {
        main: anaTarget ? `${anaTarget}から波乱を狙う` : `インが崩れる条件をチェック`,
        bubble: mainComment || `穴は展開待ち。攻め艇のスタートを見たい！`,
      },
    ],
  };

  const index = nextIndex(key, variants[key].length);
  const selected = variants[key][index];
  return { key, ...selected };
}

function buildPrompt() {
  const data = readCurrentForm();
  const detail = data.sections.map((section) => `【${section.title}】\n${section.rows.join("\n")}`).join("\n\n");
  const copy = makeCopy(data);
  const fixedCopy = copy ? `\n\n【今回画像に必ず使用する可変コピー】\nメインコピー：${copy.main}\n吹き出しコメント：${copy.bubble}\n\n・上の2文をそのまま画像内に使用する。元の固定コメントが入力欄に残っていても、メインコピーと吹き出しは上記を優先する。\n・再生成時は直前と違う文章パターンを選ぶ。\n・メインコピーと吹き出しコメントを同じ内容にしない。` : "";

  return `【BoatStrikers 画像作成プロンプト】\n\n対象：${data.mode}${data.edition ? ` / ${data.edition}` : ""}\n\n${detail}${fixedCopy}\n\n【画像生成ルール】\n・現在のBoatStrikers新聞／SNS画像／速報ステッカーの完成済みデザインを基準にする。\n・既存のキャラクター、背景、配色、ロゴ、装飾、フレーム、全体レイアウトは変更しない。\n・上記の入力データに該当する文字・数値・選択内容だけを正確に反映する。\n・艇番、レース場、R数、時刻、％、買い目などの数字を最優先で正確に表示する。\n・入力されていない情報を勝手に追加しない。\n・AI v2、shadow、model、raw、scoreなど内部用モデル名・内部指標名は表示しない。\n・[object Object]を絶対に表示しない。\n・日本語文字を崩さず、各枠内に収める。\n・完成画像としてそのまま公開できる品質で仕上げる。`;
}

export default function NewspaperPromptAssistant() {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const generate = () => {
    setPrompt(buildPrompt());
    setCopied(false);
    setOpen(true);
  };

  const refresh = () => {
    setPrompt(buildPrompt());
    setCopied(false);
  };

  const copy = async () => {
    const next = prompt || buildPrompt();
    if (!prompt) setPrompt(next);
    try {
      await navigator.clipboard.writeText(next);
    } catch {
      const area = document.createElement("textarea");
      area.value = next;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      <button className="newspaperPromptFab" onClick={generate} type="button">✨ 画像プロンプト</button>
      {open && (
        <div className="newspaperPromptBackdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <section className="newspaperPromptPanel" aria-label="画像作成プロンプト">
            <header>
              <div><span>BOATSTRIKERS AI ASSIST</span><h2>画像作成プロンプト</h2><p>再生成するたび、メインコピーと吹き出し文も変わります。</p></div>
              <button className="newspaperPromptClose" onClick={() => setOpen(false)} type="button">×</button>
            </header>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} spellCheck={false} />
            <div className="newspaperPromptActions">
              <button className="newspaperPromptRefresh" onClick={refresh} type="button">↻ コピーも含めて再生成</button>
              <button className="newspaperPromptCopy" onClick={copy} type="button">{copied ? "✓ コピーしました" : "📋 プロンプトをコピー"}</button>
            </div>
          </section>
        </div>
      )}
      <style jsx global>{`
        .newspaperPromptFab{position:fixed;right:22px;bottom:22px;z-index:80;min-height:52px;padding:0 20px;border:0;border-radius:999px;color:#fff;background:linear-gradient(135deg,#6d43d9,#168dcc);box-shadow:0 12px 32px rgba(45,74,160,.28);font-size:14px;font-weight:950;cursor:pointer}
        .newspaperPromptBackdrop{position:fixed;inset:0;z-index:100;display:flex;justify-content:flex-end;background:rgba(11,31,48,.46);backdrop-filter:blur(3px)}
        .newspaperPromptPanel{width:min(680px,92vw);height:100%;box-sizing:border-box;display:flex;flex-direction:column;gap:14px;padding:22px;background:#f8fbff;box-shadow:-18px 0 48px rgba(17,45,68,.18)}
        .newspaperPromptPanel header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.newspaperPromptPanel header span{color:#168dcc;font-size:10px;font-weight:950;letter-spacing:.12em}.newspaperPromptPanel h2{margin:4px 0 5px;color:#17344f;font-size:24px}.newspaperPromptPanel p{margin:0;color:#71889b;font-size:12px}
        .newspaperPromptClose{width:42px;height:42px;border:1px solid #dbe7ef;border-radius:12px;color:#60788c;background:#fff;font-size:24px;cursor:pointer}
        .newspaperPromptPanel textarea{flex:1;width:100%;min-height:320px;box-sizing:border-box;resize:none;border:1px solid #cfe0eb;border-radius:16px;padding:16px;color:#17344f;background:#fff;font:13px/1.75 ui-monospace,SFMono-Regular,Menlo,monospace;outline:none}
        .newspaperPromptActions{display:grid;grid-template-columns:1fr 1.35fr;gap:10px}.newspaperPromptActions button{min-height:50px;border-radius:13px;font-size:13px;font-weight:950;cursor:pointer}.newspaperPromptRefresh{border:1px solid #d4e3ed;color:#49697f;background:#fff}.newspaperPromptCopy{border:0;color:#fff;background:#168dcc}
        @media(max-width:620px){.newspaperPromptFab{right:12px;bottom:12px;min-height:48px;padding:0 16px}.newspaperPromptPanel{width:100vw;padding:14px}.newspaperPromptActions{grid-template-columns:1fr}}
      `}</style>
    </>
  );
}
