import { NextResponse } from "next/server";
import { getPublicScheduleSupabase } from "../../../../lib/scheduleSupabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const client = getPublicScheduleSupabase();
  if (!client) return NextResponse.json({ item: null });

  try {
    const { data, error } = await client
      .from("realtime_updates")
      .select("id,kind,character,title,link_url,published_at,created_at")
      .eq("is_active", true)
      .eq("show_home", true)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(1);

    if (error) throw error;

    const row = data?.[0];
    return NextResponse.json({
      item: row
        ? {
            id: row.id,
            kind: row.kind || "prediction",
            character: row.character || "all",
            title: row.title || "最新予想を更新しました",
            url: row.link_url || "https://x.com/boatstrikers",
            published_at: row.published_at || row.created_at || null,
          }
        : null,
    });
  } catch (error) {
    console.error("トップ・コンパクトリアルタイム取得エラー:", error);
    return NextResponse.json({ item: null });
  }
}
