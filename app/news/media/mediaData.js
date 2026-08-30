import { getPublicScheduleSupabase } from "../../../lib/scheduleSupabase";

export const OFFICIAL_YOUTUBE_CHANNELS = [
  ["01","kiryu","桐生","UCT2pRt_me0tOA8B2sakEv7Q"],
  ["02","toda","戸田","UCoLCf3aVRMSukwetHfn1p1A"],
  ["03","edogawa","江戸川","UCpNAwETM_vPV2Skumzc_KMA"],
  ["04","heiwajima","平和島","UCGExstl4XKMun5eY9V0zlSg"],
  ["05","tamagawa","多摩川","UC4lvZQUptR8m5VDSu49xCGQ"],
  ["06","hamanako","浜名湖","UCGZig6i5JrZ33jjW2GG6Bzw"],
  ["07","gamagori","蒲郡","UCZhuyNQgLORLjgl8hlA7uHw"],
  ["08","tokoname","常滑","UCu9lPbAk1MosTGm2yQ4BapQ"],
  ["09","tsu","津","UCEUXzh5FRxDneaLvv0YdEfQ"],
  ["10","mikuni","三国","UCu-yP6WJQ0zcx5nmWhxvJEg"],
  ["11","biwako","びわこ","UCLbcsJqsT5Qa1axpYcOBpmg"],
  ["12","suminoe","住之江","UCW3AReETO-oDmEoE-m3i7dQ"],
  ["13","amagasaki","尼崎","UC-vpH4QQKPwsqsbESOfNgZQ"],
  ["14","naruto","鳴門","UCd8rJfg7p8qsASOEIIwAinQ"],
  ["15","marugame","丸亀","UC2CWDMG18mpBGXkI9KHdACQ"],
  ["16","kojima","児島","UC6IrOXVuw6xXLl1qJqYUrsg"],
  ["17","miyajima","宮島","UCxvYC6PPCsy2_p0tGuvIv5w"],
  ["18","tokuyama","徳山","UCqyq1Dav7D5ztEl_ierxsjw"],
  ["19","shimonoseki","下関","UCl-7IwVjJHzWUhqxz7hwY1w"],
  ["20","wakamatsu","若松","UCll--OtE3eJpzb4uwX8MX9A"],
  ["21","ashiya","芦屋","UC5BunThJ_eBJq5gz-DOaRLw"],
  ["22","fukuoka","福岡","UCgyb8el3rLkg8i0bEMboQhA"],
  ["23","karatsu","唐津","UCO6ycDxAk-5OHAiKc71gNSQ"],
  ["24","omura","大村","UCPLb9R1EIqxNBy8Qzcrz8Wg"],
].map(([code,key,place,channelId]) => ({
  code,
  key,
  place,
  channelId,
  channelUrl: `https://www.youtube.com/channel/${channelId}`,
}));

function toTimestamp(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

export async function getOfficialYoutubeUpdates({ limit = 24, womenOnly = false, placeCode = null } = {}) {
  const client = getPublicScheduleSupabase();
  if (!client) return [];

  let query = client
    .from("bs_media_videos")
    .select("video_id,place_code,place_name,channel_id,channel_url,title,video_url,thumbnail_url,published_at,women_related,official_description")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(Math.min(Math.max(Number(limit) || 24, 1), 100));

  if (womenOnly) query = query.eq("women_related", true);
  if (placeCode) query = query.eq("place_code", String(placeCode).padStart(2, "0"));

  const { data, error } = await query;
  if (error) {
    console.error("MEDIA cache fetch failed:", error.message);
    return [];
  }

  return (data || []).map((row) => {
    const channel = OFFICIAL_YOUTUBE_CHANNELS.find((x) => x.code === row.place_code || x.channelId === row.channel_id);
    return {
      id: `${channel?.key || row.place_code}:${row.video_id}`,
      place: row.place_name,
      placeCode: row.place_code,
      channelKey: channel?.key || row.place_code,
      channelUrl: row.channel_url,
      title: row.title || "公式YouTube更新",
      description: row.official_description || "",
      url: row.video_url,
      videoId: row.video_id,
      thumbnailUrl: row.thumbnail_url || `https://i.ytimg.com/vi/${row.video_id}/mqdefault.jpg`,
      publishedAt: row.published_at,
      timestamp: toTimestamp(row.published_at),
      womenRelated: Boolean(row.women_related),
    };
  });
}

export function formatMediaDate(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}
