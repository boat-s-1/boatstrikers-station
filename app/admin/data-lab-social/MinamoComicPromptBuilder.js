"use client";

import { useMemo, useState } from "react";

function statsMap(payload) {
  const map = {};
  const stats = Array.isArray(payload?.stats) ? payload.stats : [];
  stats.forEach((s) => {
    map[String(s.label || "")] = String(s.value || "");
  });
  return map;
}

function rankingLines(payload) {
  const ranking = Array.isArray(payload?.venue_manshu_ranking) ? payload.venue_manshu_ranking : [];
  if (!ranking.length) return "該当データなし";
  return ranking.slice(0, 5).map((r, i) => `${i + 1}. ${r.venue || ""} ${r.count || 0}本`).join("\n");
}

function topText(payload) {
  const top = payload?.max_payout;
  if (!top) return "該当データなし";
  return `${top.venue || ""}${top.race_no || ""}R ${top.trifecta || ""} / ${Number(top.payout || 0).toLocaleString("ja-JP")}円`;
}

function clean(value) {
  return value === null || value === undefined || value === "" ? "該当データなし" : String(value);
}

export default function MinamoComicPromptBuilder({ payload }) {
  const [topic, setTopic] = useState("auto");
  const [news, setNews] = useState("");
  const [copied, setCopied] = useState(false);

  const prompt = useMemo(() => {
    const s = statsMap(payload);
    const date = payload?.date || "";
    const selectedTopic = {
      auto: "AIが実データから最も4コマ向きの話題を1つ選ぶ",
      payout: "高配当・万舟を主役にする",
      escape: "イン逃げ・1号艇を主役にする",
      boat5: "5号艇・穴決着を主役にする",
      news: "入力された時事ネタ・ニュースを主役にする",
      research: "研究部らしいデータ検証ネタを主役にする",
    }[topic] || "AIが実データから最も4コマ向きの話題を1つ選ぶ";

    return `あなたはBoatStrikersの学園4コマシリーズ「私立みなも学園〜ふなけん研究部〜」の脚本・画像生成プロンプト担当です。\n\n【最重要ルール】\n・下記の実データと、入力された時事ネタだけを事実として使用する\n・下記にない数値、場名、レース番号、出目、配当、選手名、事故内容を勝手に補完しない\n・不明な情報は創作しない\n・漫画としてのリアクション、表情、学園内の演出、オチは創作してよいが、事実関係は変更しない\n・4コマ内の数字は読みやすく、元データと完全一致させる\n\n【シリーズ名】\n私立みなも学園〜ふなけん研究部〜\n\n【舞台設定】\nみなも学園の「ふなけん研究部」。ボートレースをデータで研究する学園部活もの。\n部室にはホワイトボード、モニター、競艇場資料、艇番カラーの小物があり、明るい学園コメディの空気感。\n\n【キャラクター】\n一果：緑系。落ち着いた研究部リーダー。イン逃げ・1号艇担当。真面目でまとめ役。\n初音：紫系。不思議で可愛い女子戦オタク。独特な視点で核心を突く。少し天然。\nキイナ：黄色・ゴールド系。元気な穴党。5号艇や高配当に敏感。リアクション大きめ。\n\n【今回のテーマ方針】\n${selectedTopic}\n\n【実データ】\n日付：${date}\n開催：${clean(s["開催"] || s["開催数"])}\n万舟：${clean(s["万舟"])}\n万舟率：${clean(s["万舟率"])}\n1号艇1着：${clean(s["1号艇1着"] || s["1号艇1着数"])}\n5号艇1着：${clean(s["5号艇1着"] || s["5号艇1着数"])}\n逃げ：${clean(s["逃げ"])}\n最高配当：${topText(payload)}\n万舟が多かった場TOP5：\n${rankingLines(payload)}\n事故・異常者：${clean(payload?.incident_races)}R\n優勝戦・DR：${clean(payload?.featured_races)}R\n\n【時事ネタ・ニュース補足】\n${news.trim() || "なし。実データだけで構成する。"}\n\n【4コマの作り方】\n1コマ目：部室・教室・研究発表など、学園ものとして自然な導入。今回の話題を提示する。\n2コマ目：一果・初音・キイナの誰かがデータやニュースを解説する。\n3コマ目：別キャラが驚く、ツッコむ、独自の視点を出すなど掛け合いを強める。\n4コマ目：研究部らしい発見、笑い、ツッコミ、次の研究につながるオチで締める。\n\n【出力してほしいもの】\n1. 4コマタイトル\n2. 今回採用したテーマと、その理由を1行\n3. 1コマ目〜4コマ目の台本\n   ・場面説明\n   ・登場キャラ\n   ・セリフ\n4. 使用した事実データ一覧\n5. そのまま画像生成AIへ渡せる完成版画像生成プロンプト\n6. X投稿文（140文字程度、ハッシュタグ込み）\n\n【画像生成プロンプトの固定条件】\n・日本語の縦長4コマ漫画\n・明るくポップなアニメ調\n・4つのコマが明確に分かれている\n・キャラクター3人の色・役割を維持する\n・数字、場名、出目、配当は特に読みやすくする\n・実データ以外の数値を追加しない\n・下部に小さく「私立みなも学園〜ふなけん研究部〜」「BoatStrikers DATA LAB」\n・ニュース解説だけにせず、3人の掛け合いが主役の4コマにする。`;
  }, [payload, topic, news]);

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section style={{ marginTop: 28, padding: 20, borderRadius: 18, border: "1px solid rgba(255,255,255,.12)", background: "rgba(7,18,38,.72)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: ".12em", opacity: .68 }}>MINAMO ACADEMY COMIC STUDIO</div>
          <h2 style={{ margin: "6px 0 8px" }}>私立みなも学園〜ふなけん研究部〜</h2>
          <p style={{ margin: 0, opacity: .78, lineHeight: 1.7 }}>DATA LABの実結果を自動差し込みし、必要なら時事ネタを追記して4コマ生成用プロンプトを作ります。</p>
        </div>
        <button type="button" onClick={copyPrompt} style={{ border: 0, borderRadius: 12, padding: "12px 18px", fontWeight: 700, cursor: "pointer" }}>{copied ? "コピーしました" : "プロンプトをコピー"}</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 280px) 1fr", gap: 14, marginTop: 18 }}>
        <label style={{ display: "grid", gap: 7 }}>
          <span style={{ fontSize: 13, opacity: .75 }}>テーマ</span>
          <select value={topic} onChange={(e) => setTopic(e.target.value)} style={{ width: "100%", padding: 12, borderRadius: 10 }}>
            <option value="auto">自動選択</option>
            <option value="payout">高配当・万舟</option>
            <option value="escape">イン逃げ・1号艇</option>
            <option value="boat5">5号艇・穴</option>
            <option value="news">時事ネタ・ニュース</option>
            <option value="research">研究・検証</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 7 }}>
          <span style={{ fontSize: 13, opacity: .75 }}>時事ネタ・ニュース補足（任意）</span>
          <textarea value={news} onChange={(e) => setNews(e.target.value)} placeholder="例：徳山G1初日、○○選手が… ※確認済みの事実だけ入力" style={{ width: "100%", minHeight: 88, padding: 12, borderRadius: 10, resize: "vertical" }} />
        </label>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, opacity: .75, marginBottom: 7 }}>生成プロンプト</div>
        <textarea readOnly value={prompt} style={{ width: "100%", minHeight: 520, padding: 14, borderRadius: 12, resize: "vertical", lineHeight: 1.65, fontFamily: "inherit" }} />
      </div>
    </section>
  );
}
