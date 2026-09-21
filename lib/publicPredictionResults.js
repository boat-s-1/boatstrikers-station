import { supabase } from "../app/bsc2/lib/supabaseClient";

const PAGE_SIZE = 1000;

export const PUBLIC_PREDICTION_MEMBERS = [
  { name: "ichika", label: "一果", href: "/ichika", role: "イン逃げ担当", icon: "/results/icons/ichika.jpg" },
  { name: "hatsune", label: "初音", href: "/hatsune", role: "女子戦担当", icon: "/results/icons/hatsune.jpg" },
  { name: "kiina", label: "キイナ", href: "/kiina", role: "5アタマ担当", icon: "/results/icons/kiina.jpg" },
];

export const PUBLIC_PREDICTION_CATEGORIES = PUBLIC_PREDICTION_MEMBERS.map(
  (member) => member.label,
);

export function getJstMonthRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    start: `${year}-${String(month).padStart(2, "0")}-01`,
    end: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
    label: `${year}年${month}月`,
  };
}

export function summarizePredictionRows(rows = []) {
  const raceCount = rows.length;
  const hitCount = rows.filter(
    (row) => Boolean(row.hit) || Number(row.payout || 0) > 0,
  ).length;
  const invest = rows.reduce(
    (sum, row) => sum + Number(row.invest || 0),
    0,
  );
  const payout = rows.reduce(
    (sum, row) => sum + Number(row.payout || 0),
    0,
  );

  return {
    raceCount,
    hitCount,
    invest,
    payout,
    hitRate: raceCount > 0 ? (hitCount / raceCount) * 100 : 0,
    recoveryRate: invest > 0 ? (payout / invest) * 100 : 0,
    maxPayout: rows.reduce(
      (max, row) => Math.max(max, Number(row.payout || 0)),
      0,
    ),
  };
}

function formatDate(dateString) {
  if (!dateString) return "—";
  const [year, month, day] = dateString.split("-").map(Number);
  return `${year}/${month}/${day}`;
}

function formatUpdatedAt(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

async function fetchAllMonthlyRows(start, end) {
  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("bsc_results")
      .select(
        "id,race_date,place,race_no,category,bet_text,invest,payout,hit,memo,created_at",
      )
      .gte("race_date", start)
      .lt("race_date", end)
      .in("category", PUBLIC_PREDICTION_CATEGORIES)
      .order("race_date", { ascending: false })
      .order("race_no", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    const page = Array.isArray(data) ? data : [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

function emptyResult(range) {
  return {
    totalRace: 0,
    hitRace: 0,
    hitRate: 0,
    invest: 0,
    payout: 0,
    recoveryRate: 0,
    maxPayout: 0,
    members: PUBLIC_PREDICTION_MEMBERS.map((member) => ({
      ...member,
      raceCount: 0,
      hitCount: 0,
      hitRate: 0,
      invest: 0,
      payout: 0,
      recoveryRate: 0,
      maxPayout: 0,
    })),
    rows: [],
    monthLabel: range.label,
    periodLabel: `${formatDate(range.start)}〜—`,
    targetLabel: "一果・初音・キイナの公開予想",
    lastUpdatedLabel: "—",
  };
}

export async function getMonthlyPublicPredictionResults() {
  const range = getJstMonthRange();

  if (!supabase) {
    console.error("Supabase未接続です");
    return emptyResult(range);
  }

  try {
    const rows = await fetchAllMonthlyRows(range.start, range.end);
    const total = summarizePredictionRows(rows);
    const latestRaceDate = rows.reduce(
      (latest, row) =>
        row.race_date && (!latest || row.race_date > latest)
          ? row.race_date
          : latest,
      "",
    );
    const lastUpdatedAt = rows.reduce(
      (latest, row) =>
        row.created_at && (!latest || row.created_at > latest)
          ? row.created_at
          : latest,
      "",
    );

    return {
      totalRace: total.raceCount,
      hitRace: total.hitCount,
      hitRate: total.hitRate,
      invest: total.invest,
      payout: total.payout,
      recoveryRate: total.recoveryRate,
      maxPayout: total.maxPayout,
      members: PUBLIC_PREDICTION_MEMBERS.map((member) => ({
        ...member,
        ...summarizePredictionRows(
          rows.filter((row) => row.category === member.label),
        ),
      })),
      rows,
      monthLabel: range.label,
      periodLabel: `${formatDate(range.start)}〜${formatDate(latestRaceDate)}`,
      targetLabel: "一果・初音・キイナの公開予想",
      lastUpdatedLabel: formatUpdatedAt(lastUpdatedAt),
    };
  } catch (error) {
    console.error("公開予想実績取得エラー:", error);
    return emptyResult(range);
  }
}
