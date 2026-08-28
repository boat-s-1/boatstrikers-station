"use client";

import { useMemo, useState } from "react";

const SLOT_LABELS = {
  "10": "10:00 朝",
  "14": "14:00 昼",
  "22": "22:00 夜",
};

function scoreArticle(item, slot) {
  const category = item.category || "topic";
  const sourceType = item.source_type || "";
  const isMedia = sourceType === "news" || sourceType === "official";
  const table = {
    "10": { news: 120, women: 95, suijinsai: 90, win: 85, motor: 75, grade: 70, tomorrow: 45, result: 35, topic: 55 },
    "14": { news: 120, result: 105, win: 100, suijinsai: 95, women: 85, motor: 75, grade: 70, tomorrow: 45, topic: 60 },
    "22": { tomorrow: 140, news: 110, win: 95, result: 90, women: 80, suijinsai: 80, motor: 65, grade: 60, topic: 55 },
  };
  let score = table[slot]?.[category] ?? 50;
  if (isMedia) score += slot === "22" ? 20 : 30;
  const ageHours = Math.max(0, (Date.now() - new Date(item.published_at || 0).getTime()) / 3600000);
  score += Math.max(0, 24 - ageHours) * 0.8;
  return score;
}

function rankedArticles(articles, slot) {
  const sorted = [...articles]
    .map((item) => ({ ...item, _score: scoreArticle(item, slot) }))
    .sort((a, b) => b._score - a._score);

  const picked = [];
  const usedPlaces = new Set();
  for (const item of sorted) {
    if (picked.length >= 15) break;
    if (item.place && usedPlaces.has(item.place) && picked.length < 3) continue;
    picked.push(item);
    if (item.place) usedPlaces.add(item.place);
  }
  return picked;
}

function shortTitle(title, max = 26) {
  const text = String(title || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export default function HatsuneSnsMaker({ articles = [] }) {
  const [slot, setSlot] = useState("22");
  const ranking = useMemo(() => rankedArticles(articles, slot), [articles, slot]);
  const [manual, setManual] = useState({});
  const chosen = [0, 1, 2].map((index) => {
    const id = manual[`${slot}-${index}`];
    return ranking.find((x) => String(x.id) === String(id)) || ranking[index] || null;
  });

  const prompt = `添付した「初音のヴィーナスニュース」テンプレート画像のデザイン、キャラクター、背景、タイトル、色、レイアウトは変更せず、本日の注目トピックスの3つの白枠内だけを編集してください。\n\n1位：${shortTitle(chosen[0]?.title)}\n2位：${shortTitle(chosen[1]?.title)}\n3位：${shortTitle(chosen[2]?.title)}\n\n【文字配置】\n・既存の1・2・3の順位表示は残す\n・各枠に見出しを大きく太字で中央寄せ\n・日本語を崩さず、枠内に収める\n・読みやすさ最優先\n・上記以外は一切変更しない`;

  const post = `【初音のヴィーナスNEWS🌸】\n${chosen.map((item, i) => `${i + 1}位 ${shortTitle(item?.title, 34)}`).join("\n")}\n\n女子ボートの注目ニュースを初音目線でピックアップ✨\n詳しくは初音NEWSでチェック👇\nhttps://www.boat-strike.online/hatsune/news\n#ボートレース #女子レーサー #ヴィーナスシリーズ`;

  const setRank = (index, value) => setManual((prev) => ({ ...prev, [`${slot}-${index}`]: value }));

  return (
    <section className="snsMakerPanel">
      <div className="snsMakerHeading">
        <div><span>SNS PICKUP MAKER</span><h2>初音SNS投稿メーカー</h2><p>時間帯別の優先順位で候補を自動選出し、3件を差し替えて投稿素材を作れます。</p></div>
        <div className="slotButtons">
          {Object.entries(SLOT_LABELS).map(([key, label]) => <button type="button" key={key} onClick={() => setSlot(key)} className={slot === key ? "active" : ""}>{label}</button>)}
        </div>
      </div>

      <div className="priorityNote">
        {slot === "10" && "朝：抽出ニュース ＞ 今日の女子戦・レーサー情報 ＞ モーター・データ"}
        {slot === "14" && "昼：抽出した最新ニュース ＞ 当日結果・水神祭・優出 ＞ 追加データ"}
        {slot === "22" && "夜：明日の女子戦 ＞ 抽出したニュース ＞ 今日の結果・振り返り"}
      </div>

      <div className="rankGrid">
        {[0, 1, 2].map((index) => (
          <label key={index} className="rankCard">
            <strong>{index + 1}位</strong>
            <select value={chosen[index]?.id || ""} onChange={(e) => setRank(index, e.target.value)}>
              {ranking.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <small>{chosen[index]?.source_name || chosen[index]?.source_type || "BoatStrikers"} ・ {chosen[index]?.category || "topic"}</small>
          </label>
        ))}
      </div>

      <div className="outputGrid">
        <div><div className="outputTitle"><strong>画像編集プロンプト</strong><button type="button" onClick={() => navigator.clipboard?.writeText(prompt)}>コピー</button></div><textarea readOnly value={prompt} /></div>
        <div><div className="outputTitle"><strong>X投稿文</strong><button type="button" onClick={() => navigator.clipboard?.writeText(post)}>コピー</button></div><textarea readOnly value={post} /></div>
      </div>
    </section>
  );
}
