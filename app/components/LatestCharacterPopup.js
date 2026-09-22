import { getPublishedNewspapers } from "../../lib/newspapers";
import { getPublicScheduleSupabase } from "../../lib/scheduleSupabase";
import LatestCharacterPopupClient from "./LatestCharacterPopupClient";

const CHARACTER = {
  ichika: { name: "一果" },
  hatsune: { name: "初音" },
  kiina: { name: "キイナ" },
};

const POSE_MESSAGE = {
  normal: "新しいお知らせがあるよ！",
  point: "ここ、注目してね！",
  happy: "うれしいお知らせだよ！",
  explain: "新しい読み物を更新したよ！",
  extra: "特別なお知らせだよ！",
};

function pickPose({ kind, title = "", body = "", source }) {
  const text = `${title} ${body}`;
  if (/的中|払戻|回収|勝利|当たり|速報/.test(text) || kind === "hit") return "happy";
  if (/注目|狙い|本命|予想|買い目|レース/.test(text) || kind === "prediction") return "point";
  if (/ゼミ|研究|検証|攻略|解説|新聞|記事|DATA LAB|データ/.test(text) || kind === "update" || source === "newspaper") return "explain";
  if (/特別|限定|キャンペーン|イベント|ラジオ|動画/.test(text) || kind === "radio" || kind === "video") return "extra";
  return "normal";
}

function imageFor(characterKey, pose) {
  return `/popup/${characterKey}/${characterKey}_popup_${pose}.png`;
}

async function getLatestRealtimeUpdate() {
  const client = getPublicScheduleSupabase();
  if (!client) return null;

  const { data, error } = await client
    .from("realtime_updates")
    .select("id,kind,character,title,body,link_url,published_at,created_at")
    .eq("is_active", true)
    .in("character", ["ichika", "hatsune", "kiina"])
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("キャラポップアップ更新取得エラー:", error.message);
    return null;
  }
  return data || null;
}

function newspaperToItem(item) {
  if (!item || !CHARACTER[item.character_key]) return null;
  const edition = item.edition === "just_before" ? "直前版" : "前日版";
  return {
    id: `newspaper-${item.id || item.slug || item.published_at}`,
    source: "newspaper",
    characterKey: item.character_key,
    title: item.title || `${CHARACTER[item.character_key].name}の予想新聞`,
    body: item.summary || "",
    kind: "update",
    href: item.slug ? `/newspapers/${item.slug}` : `/${item.character_key}`,
    meta: `${edition}${item.course_name ? `・${item.course_name}${item.race_no || ""}R` : ""}`,
    publishedAt: item.published_at || item.race_date || "",
  };
}

function realtimeToItem(item) {
  if (!item || !CHARACTER[item.character]) return null;
  return {
    id: `realtime-${item.id || item.published_at || item.created_at}`,
    source: "realtime",
    characterKey: item.character,
    title: item.title || `${CHARACTER[item.character].name}からのお知らせ`,
    body: item.body || "",
    kind: item.kind || "notice",
    href: item.link_url || `/${item.character}`,
    meta: item.kind === "hit" ? "的中速報" : item.kind === "prediction" ? "予想更新" : item.kind === "radio" ? "ラジオ" : item.kind === "video" ? "動画" : "最新更新",
    publishedAt: item.published_at || item.created_at || "",
  };
}

function toTime(value) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

export default async function LatestCharacterPopup() {
  const [newspapers, realtime] = await Promise.all([
    getPublishedNewspapers({ limit: 1 }),
    getLatestRealtimeUpdate(),
  ]);

  const candidates = [
    newspaperToItem(newspapers?.[0]),
    realtimeToItem(realtime),
  ].filter(Boolean);

  if (!candidates.length) return null;

  candidates.sort((a, b) => toTime(b.publishedAt) - toTime(a.publishedAt));
  const item = candidates[0];
  const character = CHARACTER[item.characterKey];
  const pose = pickPose(item);

  return (
    <LatestCharacterPopupClient
      id={String(item.id)}
      characterKey={item.characterKey}
      name={character.name}
      image={imageFor(item.characterKey, pose)}
      pose={pose}
      message={POSE_MESSAGE[pose]}
      meta={item.meta}
      title={item.title}
      href={item.href}
    />
  );
}
