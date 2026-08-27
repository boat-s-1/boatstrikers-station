import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import SocialMaterialsPanel from "./SocialMaterialsPanel";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const STADIUMS = {
  1: "桐生", 2: "戸田", 3: "江戸川", 4: "平和島", 5: "多摩川", 6: "浜名湖",
  7: "蒲郡", 8: "常滑", 9: "津", 10: "三国", 11: "びわこ", 12: "住之江",
  13: "尼崎", 14: "鳴門", 15: "丸亀", 16: "児島", 17: "宮島", 18: "徳山",
  19: "下関", 20: "若松", 21: "芦屋", 22: "福岡", 23: "唐津", 24: "大村",
};

const TYPE_META = {
  ichika_escape_best10: { character: "一果", title: "イン逃げ期待度 BEST10", tone: "ichika" },
  hatsune_dominant_best3: { character: "初音", title: "イン逃げが圧倒的 BEST3", tone: "hatsune" },
  hatsune_risky_best3: { character: "初音", title: "インが不安 BEST3", tone: "hatsuneRisk" },
  kiina_boat5_best5: { character: "キイナ", title: "5アタマ期待 BEST5", tone: "kiina" },
};

const TYPE_ORDER = [
  "ichika_escape_best10",
  "hatsune_dominant_best3",
  "hatsune_risky_best3",
  "kiina_boat5_best5",
];

function jstToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function validTiming(value) {
  return value === "after_exhibition" ? "after_exhibition" : "previous_day";
}

function getClient({ write = false } = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = write
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function fieldKey(row, field) {
  return `${row.ranking_type}__${row.rank_no}__${field}`;
}

function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function raceKey(courseCode, raceNo) {
  return `${Number(courseCode)}:${Number(raceNo)}`;
}

async function loadRows(date, timing) {
  const client = getClient();
  if (!client) return { rows: [], error: "Supabase環境変数がありません。" };

  const [rankingResult, eventResult] = await Promise.all([
    client
      .from("ai_v2_daily_rankings")
      .select("ranking_date,character_code,ranking_type,rank_no,course_code,race_no,probability,model_version,summary,metrics,data_timing,selected_for_social,selected_for_home")
      .eq("ranking_date", date)
      .eq("data_timing", timing)
      .in("ranking_type", TYPE_ORDER)
      .order("ranking_type", { ascending: true })
      .order("rank_no", { ascending: true }),
    client
      .from("bs_race_events")
      .select("course_code,race_no,closing_time")
      .eq("race_date", date),
  ]);

  if (rankingResult.error) return { rows: [], error: rankingResult.error.message };

  const closingByRace = new Map();
  if (!eventResult.error) {
    for (const event of eventResult.data || []) {
      closingByRace.set(raceKey(event.course_code, event.race_no), event.closing_time || null);
    }
  }

  const rows = (rankingResult.data || []).map((row) => ({
    ...row,
    closing_time: closingByRace.get(raceKey(row.course_code, row.race_no)) || null,
  }));

  return { rows, error: null };
}

async function saveSelections(formData) {
  "use server";

  const date = validDate(formData.get("date")) ? String(formData.get("date")) : jstToday();
  const timing = validTiming(String(formData.get("timing") || "previous_day"));
  const client = getClient({ write: true });

  if (!client) {
    redirect(`/admin/ai-candidates?date=${date}&timing=${timing}&error=missing_service_key`);
  }

  const { data: rows, error: readError } = await client
    .from("ai_v2_daily_rankings")
    .select("ranking_type,rank_no")
    .eq("ranking_date", date)
    .eq("data_timing", timing)
    .in("ranking_type", TYPE_ORDER);

  if (readError) {
    redirect(`/admin/ai-candidates?date=${date}&timing=${timing}&error=read_failed`);
  }

  for (const row of rows || []) {
    const selectedForHome = formData.has(fieldKey(row, "home"));
    const selectedForSocial = formData.has(fieldKey(row, "social"));

    const { error } = await client
      .from("ai_v2_daily_rankings")
      .update({
        selected_for_home: selectedForHome,
        selected_for_social: selectedForSocial,
        updated_at: new Date().toISOString(),
      })
      .eq("ranking_date", date)
      .eq("data_timing", timing)
      .eq("ranking_type", row.ranking_type)
      .eq("rank_no", row.rank_no);

    if (error) {
      redirect(`/admin/ai-candidates?date=${date}&timing=${timing}&error=save_failed`);
    }
  }

  revalidatePath("/admin/ai-candidates");
  redirect(`/admin/ai-candidates?date=${date}&timing=${timing}&saved=1`);
}

export default async function AiCandidatesPage({ searchParams }) {
  const params = await searchParams;
  const date = validDate(params?.date) ? params.date : jstToday();
  const timing = validTiming(params?.timing);
  const { rows, error } = await loadRows(date, timing);
  const saved = params?.saved === "1";
  const actionError = params?.error;

  const groups = TYPE_ORDER.map((type) => ({
    type,
    meta: TYPE_META[type],
    rows: rows.filter((row) => row.ranking_type === type),
  }));

  const homeCount = rows.filter((row) => row.selected_for_home).length;
  const socialCount = rows.filter((row) => row.selected_for_social).length;
  const ichikaSocialPicks = rows
    .filter((row) => row.ranking_type === "ichika_escape_best10" && row.selected_for_social)
    .sort((a, b) => Number(a.rank_no) - Number(b.rank_no))
    .map((row) => ({
      rankNo: Number(row.rank_no),
      courseCode: Number(row.course_code),
      courseName: STADIUMS[Number(row.course_code)] || `${row.course_code}場`,
      raceNo: Number(row.race_no),
      probability: row.probability == null ? null : Number(row.probability),
      closingTime: row.closing_time,
    }));

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>AI V2 DAILY PICKS</span>
            <h1>今日使うAI候補</h1>
            <p>AIが自動抽出した候補から、ホーム掲載・SNS使用するレースを選びます。</p>
          </div>
          <Link href="/admin" className={styles.backButton}>管理トップへ</Link>
        </header>

        <section className={styles.filterCard}>
          <form method="get" className={styles.filters}>
            <label>
              <span>対象日</span>
              <input type="date" name="date" defaultValue={date} />
            </label>
            <label>
              <span>データ</span>
              <select name="timing" defaultValue={timing}>
                <option value="previous_day">前日版</option>
                <option value="after_exhibition">展示後版</option>
              </select>
            </label>
            <button type="submit">表示する</button>
          </form>
          <div className={styles.summary}>
            <span>候補 <strong>{rows.length}</strong>件</span>
            <span>ホーム <strong>{homeCount}</strong>件</span>
            <span>SNS <strong>{socialCount}</strong>件</span>
          </div>
        </section>

        {saved && <div className={styles.success}>✓ 選択内容を保存しました。SNS素材も更新されています。</div>}
        {(error || actionError) && (
          <div className={styles.error}>保存・取得時にエラーが発生しました。{error ? ` ${error}` : ""}</div>
        )}

        <SocialMaterialsPanel picks={ichikaSocialPicks} date={date} timing={timing} />

        {rows.length === 0 ? (
          <section className={styles.empty}>
            <strong>{date} の候補がありません。</strong>
            <p>AIの前日版生成が完了すると、ここに候補が表示されます。</p>
          </section>
        ) : (
          <form action={saveSelections}>
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="timing" value={timing} />

            <div className={styles.groupStack}>
              {groups.map((group) => (
                <section key={group.type} className={`${styles.group} ${styles[group.meta.tone]}`}>
                  <div className={styles.groupHeader}>
                    <div>
                      <span>{group.meta.character}</span>
                      <h2>{group.meta.title}</h2>
                    </div>
                    <strong>{group.rows.length}件</strong>
                  </div>

                  <div className={styles.cardGrid}>
                    {group.rows.map((row) => {
                      const metrics = row.metrics || {};
                      const raw = Number(metrics.raw_ranking_score);
                      const common = Number(metrics.tiebreak_common_first_probability);
                      return (
                        <article className={styles.raceCard} key={`${row.ranking_type}-${row.rank_no}`}>
                          <div className={styles.rankLine}>
                            <span className={styles.rank}>#{row.rank_no}</span>
                            <span className={styles.probability}>{pct(row.probability)}</span>
                          </div>

                          <div className={styles.raceMain}>
                            <strong>{STADIUMS[Number(row.course_code)] || `${row.course_code}場`}</strong>
                            <span>{row.race_no}R</span>
                          </div>

                          <div className={styles.metrics}>
                            {row.closing_time ? <span>〆切 {String(row.closing_time).slice(0, 5)}</span> : null}
                            {Number.isFinite(raw) && <span>AI raw {pct(raw)}</span>}
                            {Number.isFinite(common) && <span>共通1着 {pct(common)}</span>}
                          </div>

                          <div className={styles.checks}>
                            <label>
                              <input
                                type="checkbox"
                                name={fieldKey(row, "home")}
                                defaultChecked={Boolean(row.selected_for_home)}
                              />
                              <span>ホーム掲載</span>
                            </label>
                            <label>
                              <input
                                type="checkbox"
                                name={fieldKey(row, "social")}
                                defaultChecked={Boolean(row.selected_for_social)}
                              />
                              <span>SNS使用</span>
                            </label>
                          </div>

                          <small className={styles.model}>{row.model_version}</small>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            <div className={styles.stickySave}>
              <div>
                <strong>今日使うレースを選択</strong>
                <span>チェックを変更したら保存してください。SNS素材は保存後に自動更新されます。</span>
              </div>
              <button type="submit">選択を保存</button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
