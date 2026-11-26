import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { isAdminAuthenticated } from "../sync/_lib/adminAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function jstToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function raceKey(row) {
  return `${row.course_code}-${row.race_no}`;
}

function countReadyRaces(rows, field) {
  const grouped = new Map();
  for (const row of rows || []) {
    const key = raceKey(row);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  let ready = 0;
  for (const items of grouped.values()) {
    if (items.length === 6 && items.every((row) => row[field] !== null && row[field] !== undefined)) ready += 1;
  }
  return ready;
}

function sourceLabel({ boatersRows, pcRows, detailedRows, lapRows, straightRows }) {
  if (boatersRows > 0) return { label: "BOATERS取得済み", tone: "good" };
  if (pcRows > 0) return { label: "PC-KYOTEI取得済み", tone: "good" };
  if (detailedRows > 0) return { label: "詳細展示取得済み", tone: "good" };
  if (lapRows === 0 && straightRows === 0) return { label: "BOATERS未公開 / 詳細展示未取得", tone: "warn" };
  return { label: "詳細展示一部取得", tone: "warn" };
}

function pillStyle(tone) {
  const common = { display: "inline-flex", alignItems: "center", padding: "7px 11px", borderRadius: 999, fontSize: 13, fontWeight: 900 };
  if (tone === "good") return { ...common, background: "#dcfce7", color: "#166534" };
  if (tone === "bad") return { ...common, background: "#fee2e2", color: "#991b1b" };
  return { ...common, background: "#fef3c7", color: "#92400e" };
}

const card = { border: "1px solid #dbe4ee", borderRadius: 18, background: "#fff", padding: 18 };

async function loadStatus() {
  const client = getClient();
  const date = jstToday();
  if (!client) return { date, error: "Supabase環境変数が未設定です" };

  // PostgREST defaults to a 1000-row limit; a full 24-venue day can exceed it.
  async function allRows(table, columns) {
    const result = [];
    for (let offset = 0; offset < 5000; offset += 1000) {
      let query = client.from(table).select(columns)
        .eq("race_date", date)
        .order("course_code", { ascending: true })
        .order("race_no", { ascending: true });
      if (table === "bs_race_entries") query = query.order("boat_no", { ascending: true });
      const { data, error } = await query.range(offset, offset + 999);
      if (error) throw error;
      result.push(...(data || []));
      if ((data || []).length < 1000) return result;
    }
    throw new Error("展示集計の取得上限に達しました");
  }
  let events, rows;
  try {
    [events, rows] = await Promise.all([
      allRows("bs_race_events", "course_code,course_name,race_no,closing_time"),
      allRows("bs_race_entries", "course_code,race_no,boat_no,exhibition_time,official_exhibition_time,official_lap,official_turn,official_straight,official_exhibition_source,official_exhibition_synced_at,exhibition_source,exhibition_synced_at"),
    ]);
  } catch {
    return { date, error: "展示集計を取得できませんでした" };
  }
  const official = rows.filter((r) => r.official_exhibition_time != null || r.official_lap != null || r.official_turn != null || r.official_straight != null);
  const boatersRows = rows.filter((r) => String(r.official_exhibition_source || "").toLowerCase().includes("boaters")).length;
  const pcRows = rows.filter((r) => [r.official_exhibition_source, r.exhibition_source].some((source) => String(source || "").toLowerCase().includes("pc-kyotei"))).length;
  const lapRows = rows.filter((r) => r.official_lap != null).length;
  const turnRows = rows.filter((r) => r.official_turn != null).length;
  const straightRows = rows.filter((r) => r.official_straight != null).length;
  const exhibitionRows = rows.filter((r) => r.exhibition_time != null || r.official_exhibition_time != null).length;
  const lapReadyRaces = countReadyRaces(rows, "official_lap");
  const straightReadyRaces = countReadyRaces(rows, "official_straight");
  const source = sourceLabel({ boatersRows, pcRows, detailedRows: official.length, lapRows, straightRows });
  const straightPartial = lapRows > 0 && straightRows < lapRows;
  const latest = rows
    .flatMap((r) => [r.official_exhibition_synced_at, r.exhibition_synced_at])
    .filter(Boolean)
    .sort()
    .at(-1) || null;
  const byRace = new Map();
  for (const row of rows) {
    const key = raceKey(row);
    if (!byRace.has(key)) byRace.set(key, []);
    byRace.get(key).push(row);
  }
  const byVenue = new Map();
  for (const event of events) {
    const key = String(event.course_code);
    if (!byVenue.has(key)) byVenue.set(key, { name: event.course_name || key, races: 0, standard: 0, detailed: 0, missing: 0 });
    const venue = byVenue.get(key);
    venue.races += 1;
    const boats = byRace.get(raceKey(event)) || [];
    const six = boats.length === 6 && new Set(boats.map((row) => Number(row.boat_no))).size === 6;
    const standard = six && boats.every((row) => row.exhibition_time != null || row.official_exhibition_time != null);
    const detailed = six && boats.every((row) => [row.official_lap, row.lap_time, row.official_turn, row.turn_time, row.official_straight, row.straight_time].some((value) => value != null));
    if (standard) venue.standard += 1;
    if (detailed) venue.detailed += 1;
    if (!standard) venue.missing += 1;
  }
  const venues = [...byVenue.values()];

  return {
    date,
    events: (events || []).length,
    entryRows: rows.length,
    exhibitionRows,
    detailedRows: official.length,
    boatersRows,
    pcRows,
    lapRows,
    turnRows,
    straightRows,
    lapReadyRaces,
    straightReadyRaces,
    source,
    straightPartial,
    latest,
    venues,
  };
}

export default async function ExhibitionDataStatusPage() {
  // Authenticate before creating a service-role client or reading any race data.
  const authenticated = await isAdminAuthenticated().catch(() => false);
  if (!authenticated) notFound();
  const s = await loadStatus();
  const totalBoatSlots = Math.max(0, Number(s.events || 0) * 6);
  const ichikaReady = Number(s.lapReadyRaces || 0) > 0;
  const hatsuneReady = Number(s.lapReadyRaces || 0) > 0;
  const kiinaReady = Number(s.straightReadyRaces || 0) > 0;

  return (
    <main style={{ minHeight: "100vh", background: "#f5f8fb", padding: "28px 16px 56px", color: "#102033" }}>
      <div style={{ maxWidth: 1050, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: ".12em", color: "#607080" }}>BOATSTRIKERS / EXHIBITION DATA</div>
          <h1 style={{ margin: "6px 0 8px", fontSize: 30 }}>📡 展示データ判定状況</h1>
          <p style={{ margin: 0, color: "#617184" }}>BOATERS・PC-KYOTEI・通常APIの取得状況と、各通知理論が判定できる状態かを確認します。</p>
        </div>

        {s.error ? <section style={{ ...card, borderColor: "#fecaca", color: "#991b1b" }}>{s.error}</section> : (
          <>
            <section style={{ ...card, marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 13, color: "#718096" }}>{s.date}</div>
                  <h2 style={{ margin: "4px 0 0", fontSize: 21 }}>詳細展示データの取得元</h2>
                </div>
                <span style={pillStyle(s.source?.tone)}>{s.source?.label}</span>
              </div>
              <div style={{ marginTop: 10, color: "#92400e", fontSize: 13 }}>開催・出走表の基礎行がないレースは展示を表示できません。取得元の履歴だけで本日の取得成功とは判定しません。</div>
              <div style={{ marginTop: 14, color: "#617184", fontSize: 14 }}>
                最終詳細同期: {s.latest ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(s.latest)) : "未取得"}
              </div>
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 18 }}>
              <div style={card}><div style={{ color: "#718096", fontSize: 13 }}>本日開催</div><strong style={{ fontSize: 28 }}>{s.events}R</strong></div>
              <div style={card}><div style={{ color: "#718096", fontSize: 13 }}>通常展示</div><strong style={{ fontSize: 28 }}>{s.exhibitionRows}/{totalBoatSlots || s.entryRows}</strong></div>
              <div style={card}><div style={{ color: "#718096", fontSize: 13 }}>BOATERS詳細</div><strong style={{ fontSize: 28 }}>{s.boatersRows}艇</strong></div>
              <div style={card}><div style={{ color: "#718096", fontSize: 13 }}>PC-KYOTEI詳細</div><strong style={{ fontSize: 28 }}>{s.pcRows}艇</strong></div>
              <div style={card}><div style={{ color: "#718096", fontSize: 13 }}>1周</div><strong style={{ fontSize: 28 }}>{s.lapRows}艇</strong></div>
              <div style={card}><div style={{ color: "#718096", fontSize: 13 }}>直線</div><strong style={{ fontSize: 28 }}>{s.straightRows}艇</strong></div>
            </section>

            <section style={{ ...card, marginBottom: 18 }}>
              <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>場別の取得状況（本日）</h2>
              {s.venues?.length ? <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead><tr><th scope="col">場</th><th scope="col">開催</th><th scope="col">通常展示6艇</th><th scope="col">詳細展示6艇</th><th scope="col">通常展示不足</th></tr></thead>
                <tbody>{s.venues.map((venue) => <tr key={venue.name} style={{ borderTop: "1px solid #e2e8f0" }}>
                  <th scope="row">{venue.name}</th><td>{venue.races}R</td><td>{venue.standard}R</td><td>{venue.detailed}R</td><td>{venue.missing}R</td>
                </tr>)}</tbody>
              </table></div> : <p>本日の開催行がありません。展示の取得状況は判定できません。</p>}
              <p style={{ fontSize: 13, color: "#617184" }}>詳細展示は提供項目が場ごとに異なります。江戸川は独自オリ展対象外。常滑の提供再開は利用者情報を受けて確認中。締切10分前の到達は別途時刻照合が必要です。</p>
            </section>

            {s.straightPartial ? (
              <section style={{ ...card, marginBottom: 18, borderColor: "#f6d78b", background: "#fffbeb" }}>
                <strong>⚠️ 直線のみ未提供のレースがあります</strong>
                <div style={{ marginTop: 6, color: "#74520b", fontSize: 14 }}>1周データは取得できていますが、BOATERS側で直線タイムが「-」の場・レースがあります。</div>
              </section>
            ) : null}

            <section style={{ ...card, marginBottom: 18 }}>
              <h2 style={{ margin: "0 0 14px", fontSize: 21 }}>通知理論の判定可否</h2>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: 12, border: "1px solid #eef2f6", borderRadius: 12 }}>
                  <div><strong>🏁 一果・隠れイン理論</strong><div style={{ fontSize: 13, color: "#718096", marginTop: 3 }}>1周タイムを使用 / 6艇揃い {s.lapReadyRaces}R</div></div>
                  <span style={pillStyle(ichikaReady ? "good" : "bad")}>{ichikaReady ? "判定可能" : "判定不可"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: 12, border: "1px solid #eef2f6", borderRadius: 12 }}>
                  <div><strong>🌸 初音・女子イン崩れ理論</strong><div style={{ fontSize: 13, color: "#718096", marginTop: 3 }}>1周タイムを使用 / 6艇揃い {s.lapReadyRaces}R</div></div>
                  <span style={pillStyle(hatsuneReady ? "good" : "bad")}>{hatsuneReady ? "判定可能" : "判定不可"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: 12, border: "1px solid #eef2f6", borderRadius: 12 }}>
                  <div><strong>🚨 キイナ・4→5展開理論</strong><div style={{ fontSize: 13, color: "#718096", marginTop: 3 }}>直線タイムを使用 / 6艇揃い {s.straightReadyRaces}R</div></div>
                  <span style={pillStyle(kiinaReady ? "good" : "bad")}>{kiinaReady ? "判定可能" : "判定不可"}</span>
                </div>
              </div>
            </section>

            <section style={{ ...card, background: "#f8fafc" }}>
              <strong>判定の見方</strong>
              <p style={{ margin: "8px 0 0", color: "#617184", lineHeight: 1.7, fontSize: 14 }}>
                「成立0件」でも、このページが「判定可能」なら本当に条件該当0件の可能性が高いです。「判定不可」の場合は、BOATERS未公開・直線未提供・詳細展示未取得などデータ側の理由を先に確認してください。
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
