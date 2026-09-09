import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase環境変数がありません。");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function normalizeDate(value) {
  const s = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("date は YYYY-MM-DD 形式で指定してください。");
  return s;
}

function jstToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function htmlToLines(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/tr>|<\/td>|<\/th>|<\/div>|<\/p>|<\/li>|<\/h\d>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .split(/\r?\n/)
    .map((line) => line.replace(/[\t\u3000 ]+/g, " ").trim())
    .filter(Boolean);
}

function detectCancellation(lines) {
  const joined = lines.join(" ");
  const wholeDay = /中止順延|開催中止|全(?:レース)?中止|全競走中止|荒天.*中止|悪天候.*中止/.test(joined);
  const raceNos = new Set();

  for (let i = 0; i < lines.length; i += 1) {
    if (!/(?:中止|不成立|競走中止)/.test(lines[i])) continue;
    const nearby = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 6));
    for (const line of nearby) {
      const matches = [...line.matchAll(/(?:^|[^0-9])(1[0-2]|[1-9])\s*R(?:[^0-9]|$)/gi)];
      for (const match of matches) raceNos.add(Number(match[1]));
    }
  }

  return { wholeDay, raceNos: [...raceNos].sort((a, b) => a - b) };
}

async function fetchOfficialResultList(raceDate, courseCode) {
  const hd = raceDate.replaceAll("-", "");
  const jcd = String(courseCode).padStart(2, "0");
  const url = `https://www.boatrace.jp/owpc/pc/race/resultlist?jcd=${jcd}&hd=${hd}`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; BoatStrikers/1.0; +https://www.boat-strike.online/)",
      accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`BOAT RACE公式取得失敗 ${jcd}: HTTP ${response.status}`);
  const html = await response.text();
  return { url, lines: htmlToLines(html) };
}

export async function syncOfficialRaceCancellations({ date } = {}) {
  const raceDate = normalizeDate(date || jstToday());
  const client = getClient();

  const { data: rows, error } = await client
    .from("bs_race_events")
    .select("course_code,course_name,race_no,result_available,race_cancel_code,race_status")
    .eq("race_date", raceDate)
    .order("course_code")
    .order("race_no");
  if (error) throw error;
  if (!rows?.length) return { ok: true, race_date: raceDate, checked_venues: 0, updated_races: 0, details: [] };

  const pending = rows.filter((row) => row.result_available !== true && !String(row.race_cancel_code || "").trim());
  const byVenue = new Map();
  for (const row of pending) {
    if (!byVenue.has(row.course_code)) byVenue.set(row.course_code, []);
    byVenue.get(row.course_code).push(row);
  }

  const details = [];
  let updatedRaces = 0;

  for (const [courseCode, venueRows] of byVenue.entries()) {
    try {
      const official = await fetchOfficialResultList(raceDate, courseCode);
      const detected = detectCancellation(official.lines);
      const targets = detected.wholeDay
        ? venueRows
        : venueRows.filter((row) => detected.raceNos.includes(Number(row.race_no)));

      if (!targets.length) {
        details.push({ course_code: courseCode, venue: venueRows[0]?.course_name, status: "no_cancel_detected", source_url: official.url });
        continue;
      }

      const targetRaceNos = targets.map((row) => Number(row.race_no));
      const cancelCode = detected.wholeDay ? "weather_postponed" : "official_cancelled";
      const { error: updateError } = await client
        .from("bs_race_events")
        .update({ race_cancel_code: cancelCode, race_status: "cancelled", updated_at: new Date().toISOString() })
        .eq("race_date", raceDate)
        .eq("course_code", courseCode)
        .in("race_no", targetRaceNos)
        .eq("result_available", false);
      if (updateError) throw updateError;

      updatedRaces += targetRaceNos.length;
      details.push({
        course_code: courseCode,
        venue: venueRows[0]?.course_name,
        status: "updated",
        whole_day: detected.wholeDay,
        race_nos: targetRaceNos,
        cancel_code: cancelCode,
        source_url: official.url,
      });
    } catch (err) {
      details.push({ course_code: courseCode, venue: venueRows[0]?.course_name, status: "error", error: err?.message || String(err) });
    }
  }

  return { ok: true, race_date: raceDate, checked_venues: byVenue.size, updated_races: updatedRaces, details };
}
