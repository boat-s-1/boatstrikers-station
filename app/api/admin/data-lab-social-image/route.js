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
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(180deg,#06172d 0%,#0a2a55 54%,#071a33 100%)", color: "white", padding: "64px 64px 58px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", border: "2px solid rgba(255,255,255,.13)", borderRadius: 42, padding: "38px 42px 40px", background: "rgba(5,22,45,.70)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", fontSize: 29, fontWeight: 900, letterSpacing: 2 }}>BS DATA LAB</div>
              <div style={{ display: "flex", gap: 7 }}>
                <div style={{ display: "flex", width: 26, height: 8, borderRadius: 999, background: "#ef4444" }} />
                <div style={{ display: "flex", width: 26, height: 8, borderRadius: 999, background: "#38bdf8" }} />
                <div style={{ display: "flex", width: 26, height: 8, borderRadius: 999, background: "#facc15" }} />
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 31, fontWeight: 800, opacity: .86 }}>{fmtDate(data.race_date)}</div>
          </div>

          <div style={{ marginTop: 42, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", maxWidth: 860, fontSize: 56, fontWeight: 900, lineHeight: 1.2, letterSpacing: -1 }}>{p.title || "昨日のボートレースを数字で見る"}</div>
            <div style={{ display: "flex", marginTop: 22, fontSize: 45, fontWeight: 900, color: "#facc15" }}>{p.headline || ""}</div>
          </div>
        </div>

        <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 16 }}>
          {stats.slice(0, 6).map((s, i) => (
            <div key={i} style={{ width: i === 0 ? "100%" : "48.9%", minHeight: i === 0 ? 118 : 126, borderRadius: 24, background: "rgba(255,255,255,.095)", border: "2px solid rgba(255,255,255,.14)", padding: "20px 26px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ display: "flex", fontSize: 23, opacity: .7, fontWeight: 700 }}>{String(s.label || "")}</div>
              <div style={{ display: "flex", marginTop: 7, fontSize: i === 0 ? 47 : 42, fontWeight: 900, lineHeight: 1.05 }}>{String(s.value || "")}</div>
            </div>
          ))}
        </div>

        {top && (
          <div style={{ marginTop: 26, borderRadius: 28, background: "#fff", color: "#07182e", padding: "28px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 24, fontWeight: 800, opacity: .7 }}>最高配当</div>
              <div style={{ display: "flex", marginTop: 8, fontSize: 38, fontWeight: 900 }}>{`${top.venue || ""}${top.race_no || ""}R  ${top.trifecta || ""}`}</div>
            </div>
            <div style={{ display: "flex", fontSize: 58, fontWeight: 900, letterSpacing: -2 }}>{`${Number(top.payout || 0).toLocaleString("ja-JP")}円`}</div>
          </div>
        )}

        <div style={{ marginTop: 26, display: "flex", gap: 18 }}>
          <div style={{ flex: 1, minHeight: 280, borderRadius: 26, background: "rgba(255,255,255,.075)", border: "2px solid rgba(255,255,255,.10)", padding: "26px 28px", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 25, fontWeight: 900 }}>万舟が多かった場 TOP5</div>
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {ranking.slice(0, 5).map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 23 }}>
                  <span>{`${i + 1}. ${r.venue || ""}`}</span>
                  <strong>{`${r.count || 0}本`}</strong>
                </div>
              ))}
              {!ranking.length && <div style={{ display: "flex", fontSize: 23, opacity: .65 }}>該当なし</div>}
            </div>
          </div>

          <div style={{ width: 300, minHeight: 280, borderRadius: 26, background: "rgba(255,255,255,.075)", border: "2px solid rgba(255,255,255,.10)", padding: "26px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 22, opacity: .7, fontWeight: 700 }}>事故・異常着</div>
              <div style={{ display: "flex", marginTop: 4, fontSize: 48, fontWeight: 900 }}>{`${p.incident_races || 0}R`}</div>
            </div>
            <div style={{ display: "flex", height: 2, background: "rgba(255,255,255,.12)" }} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 22, opacity: .7, fontWeight: 700 }}>優勝戦・DR</div>
              <div style={{ display: "flex", marginTop: 4, fontSize: 48, fontWeight: 900 }}>{`${p.featured_races || 0}R`}</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "auto", borderRadius: 24, background: "rgba(255,255,255,.08)", padding: "24px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "2px solid rgba(255,255,255,.10)" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 26, fontWeight: 900 }}>昨日の結果を、数字で振り返る。</div>
            <div style={{ display: "flex", marginTop: 5, fontSize: 20, opacity: .66 }}>万舟・艇番別勝利・決まり手を毎日集計</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 900 }}>BoatStrikers</div>
            <div style={{ display: "flex", marginTop: 4, fontSize: 20, opacity: .72 }}>boat-strike.online</div>
          </div>
        </div>
      </div>,
      { width: 1080, height: 1920 }
    );
  } catch (error) {
    return new Response(error?.message || String(error), { status: 500 });
  }
}
