export const HATSUNE_SCHEDULE_SOURCE = "https://www.ladies-info.jp/racecalendar/";

export const HATSUNE_WOMEN_SCHEDULE = [
  { id: "20260830-hamanako-al", start: "2026-08-30", end: "2026-09-04", place: "浜名湖", type: "オールレディース", title: "オールレディース静岡クラウンメロン杯" },
  { id: "20260906-naruto-vs", start: "2026-09-06", end: "2026-09-11", place: "鳴門", type: "ヴィーナスシリーズ", title: "ヴィーナスシリーズ第12戦 マクール杯競走" },
  { id: "20260912-tokoname-vs", start: "2026-09-12", end: "2026-09-17", place: "常滑", type: "ヴィーナスシリーズ", title: "ヴィーナスシリーズ第13戦" },
  { id: "20260918-miyajima-al", start: "2026-09-18", end: "2026-09-23", place: "宮島", type: "オールレディース", title: "GIII オールレディース" },
  { id: "20260924-ashiya-al", start: "2026-09-24", end: "2026-09-29", place: "芦屋", type: "オールレディース", title: "GIII オールレディース マクール杯" },
  { id: "20261001-shimonoseki-vs", start: "2026-10-01", end: "2026-10-06", place: "下関", type: "ヴィーナスシリーズ", title: "ヴィーナスシリーズ第14戦" },
  { id: "20261007-edogawa-al", start: "2026-10-07", end: "2026-10-12", place: "江戸川", type: "オールレディース", title: "GIII オールレディース" },
  { id: "20261013-wakamatsu-vs", start: "2026-10-13", end: "2026-10-18", place: "若松", type: "ヴィーナスシリーズ", title: "ヴィーナスシリーズ第15戦" },
  { id: "20261019-suminoe-al", start: "2026-10-19", end: "2026-10-24", place: "住之江", type: "オールレディース", title: "GIII オールレディース" },
  { id: "20261025-kiryu-vs", start: "2026-10-25", end: "2026-10-30", place: "桐生", type: "ヴィーナスシリーズ", title: "ヴィーナスシリーズ第16戦" },
  { id: "20261031-tsu-al", start: "2026-10-31", end: "2026-11-05", place: "津", type: "オールレディース", title: "GIII オールレディース" },
];

function jstDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type)?.value;
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

export function getScheduleStatus(item, now = new Date()) {
  const today = jstDateKey(now);
  if (today < item.start) return "upcoming";
  if (today > item.end) return "finished";
  return "running";
}

export function getUpcomingWomenSchedule(limit = 3, now = new Date()) {
  return HATSUNE_WOMEN_SCHEDULE
    .filter((item) => getScheduleStatus(item, now) !== "finished")
    .slice(0, limit);
}

export function formatScheduleRange(item) {
  const [sy, sm, sd] = item.start.split("-");
  const [ey, em, ed] = item.end.split("-");
  if (sy === ey && sm === em) return `${Number(sm)}/${Number(sd)}〜${Number(ed)}`;
  if (sy === ey) return `${Number(sm)}/${Number(sd)}〜${Number(em)}/${Number(ed)}`;
  return `${sy}/${Number(sm)}/${Number(sd)}〜${ey}/${Number(em)}/${Number(ed)}`;
}
