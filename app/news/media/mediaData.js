import Parser from "rss-parser";

export const OFFICIAL_YOUTUBE_CHANNELS = [
  {
    key: "gamagori",
    place: "蒲郡",
    channelId: "UCZhuyNQgLORLjgl8hlA7uHw",
    channelUrl: "https://www.youtube.com/channel/UCZhuyNQgLORLjgl8hlA7uHw",
  },
  {
    key: "suminoe",
    place: "住之江",
    channelId: "UCW3AReETO-oDmEoE-m3i7dQ",
    channelUrl: "https://www.youtube.com/channel/UCW3AReETO-oDmEoE-m3i7dQ",
  },
  {
    key: "omura",
    place: "大村",
    channelId: "UCPLb9R1EIqxNBy8Qzcrz8Wg",
    channelUrl: "https://www.youtube.com/channel/UCPLb9R1EIqxNBy8Qzcrz8Wg",
  },
];

const WOMEN_KEYWORDS = [
  "女子",
  "ヴィーナス",
  "オールレディース",
  "レディース",
  "クイーンズ",
  "女王",
  "女子レーサー",
  "女子選手",
];

function getVideoId(item) {
  const link = String(item?.link || "");
  const match = link.match(/[?&]v=([^&]+)/);
  if (match?.[1]) return match[1];

  const id = String(item?.id || item?.guid || "");
  const colon = id.match(/yt:video:([^\s]+)/);
  return colon?.[1] || "";
}

function toTimestamp(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isWomenRelated(title) {
  const text = String(title || "");
  return WOMEN_KEYWORDS.some((keyword) => text.includes(keyword));
}

async function loadChannel(channel) {
  const parser = new Parser();
  const feed = await parser.parseURL(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`
  );

  return (feed.items || []).slice(0, 8).map((item) => {
    const videoId = getVideoId(item);
    const publishedAt = item.isoDate || item.pubDate || "";
    return {
      id: `${channel.key}:${videoId || item.link}`,
      place: channel.place,
      channelKey: channel.key,
      channelUrl: channel.channelUrl,
      title: item.title || "公式YouTube更新",
      url: item.link || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : channel.channelUrl),
      videoId,
      thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : "",
      publishedAt,
      timestamp: toTimestamp(publishedAt),
      womenRelated: isWomenRelated(item.title),
    };
  });
}

export async function getOfficialYoutubeUpdates({ limit = 24, womenOnly = false } = {}) {
  const results = await Promise.allSettled(OFFICIAL_YOUTUBE_CHANNELS.map(loadChannel));
  const merged = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  return merged
    .filter((item) => !womenOnly || item.womenRelated)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
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
