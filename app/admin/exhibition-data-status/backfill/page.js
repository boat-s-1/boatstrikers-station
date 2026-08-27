import BackfillButton from "../BackfillButton";

export const dynamic = "force-dynamic";

function jstToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function ExhibitionBackfillPage() {
  const date = jstToday();
  return (
    <main style={{ minHeight: "100vh", background: "#f5f8fb", padding: "28px 16px 56px", color: "#102033" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <section style={{ border: "1px solid #dbe4ee", borderRadius: 18, background: "#fff", padding: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: ".12em", color: "#607080" }}>BOATSTRIKERS / EXHIBITION BACKFILL</div>
          <h1 style={{ margin: "8px 0 8px", fontSize: 28 }}>📥 今日の展示詳細を再取得</h1>
          <p style={{ margin: "0 0 18px", color: "#617184", lineHeight: 1.7 }}>
            今日の全レースをBOATERSから再確認し、取得できなかった場合は対応済みの競艇場公式サイトも確認します。取得できた1周・まわり足・直線・展示データをSupabaseへ追記します。
          </p>
          <div style={{ marginBottom: 14, fontSize: 14, fontWeight: 800 }}>対象日：{date}</div>
          <BackfillButton date={date} />
          <p style={{ margin: "16px 0 0", fontSize: 13, color: "#718096", lineHeight: 1.65 }}>
            過去レースでもBOATERS側にページが残っていれば取得できます。BOATERS・公式サイトの両方に公開されていないデータは取得不可として残します。
          </p>
        </section>
      </div>
    </main>
  );
}
