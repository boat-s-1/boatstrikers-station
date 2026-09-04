import { createClient } from "@supabase/supabase-js";

const COURSE_NAMES = {
  1: "桐生", 2: "戸田", 3: "江戸川", 4: "平和島", 5: "多摩川", 6: "浜名湖",
  7: "蒲郡", 8: "常滑", 9: "津", 10: "三国", 11: "びわこ", 12: "住之江",
  13: "尼崎", 14: "鳴門", 15: "丸亀", 16: "児島", 17: "宮島", 18: "徳山",
  19: "下関", 20: "若松", 21: "芦屋", 22: "福岡", 23: "唐津", 24: "大村",
};
const COURSE_CODES = Object.fromEntries(Object.entries(COURSE_NAMES).map(([code, name]) => [name, Number(code)]));
const RESULT_CLAIM_RE = /(が(?:見事)?優勝|優勝を飾|V達成|連続V|勝利を飾|イン逃げを決め|結果(?:は|を更新)|払戻|万舟|高配当|3連単[^。\n]*(?:円|配当))/;
const OFFICIAL_HOSTS = ["boatrace.jp"];
const TRUSTED_NEWS_HOSTS = ["hochi.news", "nikkansports.com", "sanspo.com", "sports.yahoo.co.jp", "daily.co.jp", "tokyo-sports.co.jp"];

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase環境変数がありません。");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function jstDateString(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

function candidateText(item) {
  return `${item?.title || ""} ${item?.summary || ""}`;
}

function inferVenue(item) {
  if (item?.venue && COURSE_CODES[item.venue]) return item.venue;
  const text = candidateText(item);
  return Object.values(COURSE_NAMES).find((name) => text.includes(name)) || null;
}

function inferRaceNo(item) {
  const direct = Number(item?.race_no);
  if (Number.isInteger(direct) && direct >= 1 && direct <= 12) return direct;
  const text = candidateText(item);
  const match = text.match(/(?:^|[^0-9])(1[0-2]|[1-9])\s*R(?:[^A-Za-z]|$)/i);
  if (match) return Number(match[1]);
  if (/優勝戦/.test(text) && RESULT_CLAIM_RE.test(text)) return 12;
  return null;
}

function inferEventDate(item) {
  if (item?.event_date) return String(item.event_date).slice(0, 10);
  const raw = item?.raw_payload || {};
  if (/^20\d{2}-\d{2}-\d{2}$/.test(String(raw.target_date || ""))) return raw.target_date;
  if (item?.published_at) return jstDateString(new Date(item.published_at));
  return jstDateString();
}

function isResultClaim(item) {
  return RESULT_CLAIM_RE.test(candidateText(item));
}

function sameOrFutureDate(date) {
  return date >= jstDateString();
}

function deadlineIso(date, time) {
  if (!date || !time) return null;
  const clean = String(time).slice(0, 8);
  const iso = `${date}T${clean}+09:00`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function resolveSource(url) {
  if (!url) return { ok: false, finalUrl: null, host: null, status: null };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: { "User-Agent": "BoatStrikers/1.0 (+https://www.boat-strike.online/)" },
    });
    const finalUrl = response.url || url;
    let host = null;
    try { host = new URL(finalUrl).hostname.toLowerCase(); } catch {}
    return { ok: response.ok, finalUrl, host, status: response.status };
  } catch (error) {
    return { ok: false, finalUrl: null, host: null, status: null, error: error?.message || String(error) };
  } finally {
    clearTimeout(timer);
  }
}

function sourceTrust(source) {
  const host = source?.host || "";
  if (OFFICIAL_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`))) return "official";
  if (TRUSTED_NEWS_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`))) return "trusted_media";
  return source?.ok ? "reachable" : "unresolved";
}

async function findRace(client, { eventDate, venue, raceNo }) {
  const courseCode = venue ? COURSE_CODES[venue] : null;
  if (!eventDate || !courseCode || !raceNo) return null;
  const { data, error } = await client
    .from("bs_race_events")
    .select("race_date,course_code,course_name,race_no,race_name,deadline_time,closing_time,result_available,race_cancel_code,trifecta,trifecta_payout,winning_technique_code")
    .eq("race_date", eventDate)
    .eq("course_code", courseCode)
    .eq("race_no", raceNo)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

function characterFor(item) {
  const text = `${candidateText(item)} ${item?.category || ""}`;
  if (/女子|レディース|ヴィーナス|水神祭|女子レーサー/.test(text)) return "hatsune";
  if (/万舟|高配当|穴|4カド|カド|5号艇|外枠/.test(text)) return "kiina";
  if (/イン逃げ|1号艇|1コース|優勝戦/.test(text)) return "ichika";
  return item?.target_character || "boatstrikers";
}

export async function verifyNewsCandidate(item, { client = getClient(), now = new Date() } = {}) {
  const eventDate = inferEventDate(item);
  const venue = inferVenue(item);
  const raceNo = inferRaceNo(item);
  const resultClaim = isResultClaim(item);
  const race = await findRace(client, { eventDate, venue, raceNo });
  const deadline = race ? deadlineIso(eventDate, race.deadline_time || race.closing_time) : item?.race_deadline || null;
  const deadlinePassed = deadline ? now.getTime() > new Date(deadline).getTime() : !sameOrFutureDate(eventDate);
  const resultAvailable = Boolean(race?.result_available);
  const cancelled = Boolean(race?.race_cancel_code);
  const source = await resolveSource(item?.source_url);
  const trust = sourceTrust(source);

  let verificationStatus = "pending";
  // A future deadline always wins over any stale/early result_available flag.
  // "confirmed" is reserved strictly for a race whose deadline has passed and whose result is available.
  let resultStatus = cancelled
    ? "cancelled"
    : deadline && !deadlinePassed
      ? "scheduled"
      : deadlinePassed && resultAvailable
        ? "confirmed"
        : deadlinePassed && race
          ? "running"
          : "unknown";
  let note = "source_needs_review";
  let xCandidate = false;

  if (resultClaim) {
    if (race && (!deadlinePassed || !resultAvailable)) {
      verificationStatus = "rejected";
      resultStatus = deadline && !deadlinePassed ? "scheduled" : "running";
      note = "future_or_unconfirmed_result_claim";
    } else if (race && deadlinePassed && resultAvailable) {
      verificationStatus = "verified";
      resultStatus = "confirmed";
      note = "race_result_confirmed_by_bs_race_events";
      xCandidate = true;
    } else {
      verificationStatus = "pending";
      note = "result_claim_missing_race_confirmation";
    }
  } else if (race) {
    verificationStatus = "verified";
    if (cancelled) {
      resultStatus = "cancelled";
      note = "cancelled_race_confirmed_by_bs_race_events";
    } else if (deadline && !deadlinePassed) {
      resultStatus = "scheduled";
      note = "scheduled_race_confirmed_by_bs_race_events";
    } else if (deadlinePassed && resultAvailable) {
      resultStatus = "confirmed";
      note = "race_fact_confirmed_by_bs_race_events";
    } else if (deadlinePassed) {
      resultStatus = "running";
      note = "race_started_result_not_available";
    } else {
      resultStatus = "unknown";
      note = "race_exists_timing_unknown";
    }
    xCandidate = true;
  } else if (trust === "official" || trust === "trusted_media") {
    verificationStatus = "verified";
    note = trust === "official" ? "official_source_resolved" : "trusted_media_source_resolved";
    xCandidate = true;
  } else if (source.ok && !sameOrFutureDate(eventDate)) {
    verificationStatus = "verified";
    note = "source_resolved_non_result_news";
    xCandidate = true;
  }

  return {
    event_date: eventDate,
    venue,
    race_no: raceNo,
    race_deadline: deadline,
    event_type: resultClaim ? "result_claim" : item?.event_type || "news",
    source_type: trust,
    verification_status: verificationStatus,
    result_status: resultStatus,
    verified: verificationStatus === "verified",
    verified_at: verificationStatus === "verified" ? now.toISOString() : null,
    verification_note: note,
    verification_evidence: {
      checked_at: now.toISOString(),
      source_ok: Boolean(source.ok),
      source_final_url: source.finalUrl,
      source_host: source.host,
      source_http_status: source.status,
      source_trust: trust,
      result_claim: resultClaim,
      race_found: Boolean(race),
      result_available: resultAvailable,
      deadline_passed: Boolean(deadlinePassed),
      race_name: race?.race_name || null,
      trifecta: race?.trifecta || null,
      trifecta_payout: race?.trifecta_payout || null,
    },
    x_candidate: xCandidate,
    x_character: xCandidate ? characterFor(item) : null,
    x_status: xCandidate && item?.x_status === "none" ? "none" : item?.x_status || "none",
  };
}

export async function verifyPendingNewsCandidates({ limit = 40 } = {}) {
  const client = getClient();
  const { data: items, error } = await client
    .from("bs_news_candidates")
    .select("id,collected_at,published_at,title,category,summary,source_name,source_url,importance,target_character,status,collected_by,raw_payload,event_date,venue,race_no,race_deadline,event_type,verification_status,result_status,x_status")
    .in("verification_status", ["pending", "rejected"])
    .gte("collected_at", new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString())
    .order("collected_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const result = { scanned: items?.length || 0, verified: 0, rejected: 0, pending: 0, errors: [] };
  for (const item of items || []) {
    try {
      const patch = await verifyNewsCandidate(item, { client });
      const { error: updateError } = await client.from("bs_news_candidates").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", item.id);
      if (updateError) throw updateError;
      if (patch.verification_status === "verified") result.verified += 1;
      else if (patch.verification_status === "rejected") result.rejected += 1;
      else result.pending += 1;
    } catch (error) {
      result.errors.push({ id: item.id, error: error?.message || String(error) });
    }
  }

  await client.from("bs_news_sync_logs").insert({
    run_type: "verify",
    source: "bs_news_candidates",
    found_count: result.scanned,
    verified_count: result.verified,
    rejected_count: result.rejected,
    error_count: result.errors.length,
    details: { pending_count: result.pending },
  });

  return result;
}
