import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase環境変数がありません。");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function fmtDate(value) {
  const [y, m, d] = String(value || "").split("-");
  return y && m && d ? `${Number(m)}/${Number(d)}` : "";
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    if (!date) return new Response("date is required", { status: 400 });

    const client = getClient();
    const { data, error } = await client
      .from("bs_data_lab_social_outputs")
      .select("race_date,image_payload")
      .eq("race_date", date)
      .maybeSingle();
    if (error) throw error;
    if (!data) return new Response("not found", { status: 404 });

    const p = data.image_payload || {};
    const stats = Array.isArray(p.stats) ? p.stats : [];
    const ranking = Array.isArray(p.venue_manshu_ranking) ? p.venue_manshu_ranking : [];
    const top = p.max_payout || null;

    return new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(180deg,#07182e 0%,#0b2850 60%,#081b34 100%)", color: "white", padding: "86px 76px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: 2 }}>BOATSTRIKERS DATA LAB</div>
          <div style={{ fontSize: 34, fontWeight: 700, opacity: .85 }}>{fmtDate(data.race_date)}</div>
        </div>

        <div style={{ marginTop: 80, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 66, fontWeight: 900, lineHeight: 1.15 }}>{p.title || "昨日のボートレースを数字で見る"}</div>
          <div style={{ marginTop: 28, fontSize: 50, fontWeight: 900, color: "#ffd24d" }}>{p.headline || ""}</div>
        </div>

        <div style={{ marginTop: 70, display: "flex", flexWrap: "wrap", gap: 22 }}>
          {stats.slice(0, 6).map((s, i) => (
            <div key={i} style={{ width: i === 0 ? "100%" : "47.8%", borderRadius: 28, background: "rgba(255,255,255,.10)", border: "2px solid rgba(255,255,255,.18)", padding: "28px 32px", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 28, opacity: .75 }}>{s.label}</div>
              <div style={{ marginTop: 10, fontSize: i === 0 ? 54 : 48, fontWeight: 900 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {top && (
          <div style={{ marginTop: 34, borderRadius: 30, background: "#fff", color: "#07182e", padding: "34px 38px", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 28, fontWeight: 800 }}>💰 最高配当</div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div style={{ fontSize: 44, fontWeight: 900 }}>{top.venue}{top.race_no}R　{top.trifecta}</div>
              <div style={{ fontSize: 56, fontWeight: 900 }}>{Number(top.payout || 0).toLocaleString("ja-JP")}円</div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 34, display: "flex", gap: 24 }}>
          <div style={{ flex: 1, borderRadius: 28, background: "rgba(255,255,255,.08)", padding: "30px" }}>
            <div style={{ fontSize: 29, fontWeight: 800 }}>万舟が多かった場</div>
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              {ranking.slice(0, 5).map((r, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 27 }}><span>{i + 1}. {r.venue}</span><strong>{r.count}本</strong></div>)}
              {!ranking.length && <div style={{ fontSize: 26, opacity: .65 }}>該当なし</div>}
            </div>
          </div>
          <div style={{ width: 330, borderRadius: 28, background: "rgba(255,255,255,.08)", padding: "30px", display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 26, opacity: .75 }}>事故・異常着</div>
            <div style={{ fontSize: 54, fontWeight: 900 }}>{p.incident_races || 0}R</div>
            <div style={{ fontSize: 26, opacity: .75 }}>優勝戦・DR</div>
            <div style={{ fontSize: 54, fontWeight: 900 }}>{p.featured_races || 0}R</div>
          </div>
        </div>

        <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 38, borderTop: "2px solid rgba(255,255,255,.16)" }}>
          <div style={{ fontSize: 29, fontWeight: 800 }}>昨日の結果を、数字で振り返る。</div>
          <div style={{ fontSize: 28, opacity: .75 }}>boat-strike.online</div>
        </div>
      </div>,
      { width: 1080, height: 1920 }
    );
  } catch (error) {
    return new Response(error?.message || String(error), { status: 500 });
  }
}
