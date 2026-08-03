import Link from "next/link";
import { supabase } from "../bsc2/lib/supabaseClient";
import styles from "./results.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function monthRange() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric" }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return { start, end: `${ny}-${String(nm).padStart(2, "0")}-01`, label: `${y}年${m}月` };
}

function summarize(rows) {
  const raceCount = rows.length;
  const hitCount = rows.filter((r) => Boolean(r.hit) || Number(r.payout || 0) > 0).length;
  const invest = rows.reduce((s, r) => s + Number(r.invest || 0), 0);
  const payout = rows.reduce((s, r) => s + Number(r.payout || 0), 0);
  return { raceCount, hitCount, invest, payout, hitRate: raceCount ? Math.round(hitCount / raceCount * 1000) / 10 : 0, returnRate: invest ? Math.round(payout / invest * 1000) / 10 : 0, maxPayout: rows.reduce((m,r)=>Math.max(m,Number(r.payout||0)),0) };
}

export const metadata = {
  title: "BoatStrikers予想実績｜的中率・回収率",
  description:
    "一果、初音、キイナのボートレース予想実績を掲載。予想数、的中率、回収率、最高払戻などを確認できます。",
};

export default async function ResultsPage() {
  const { start, end, label } = monthRange();
  let rows = [];
  if (supabase) {
    const { data, error } = await supabase.from("bsc_results").select("id,race_date,place,race_no,category,bet_text,invest,payout,hit,memo").gte("race_date", start).lt("race_date", end).order("race_date", { ascending: false }).order("race_no", { ascending: false });
    if (!error && Array.isArray(data)) rows = data;
  }
  const total = summarize(rows);
  const members = ["一果","初音","キイナ"].map((label) => ({ label, ...summarize(rows.filter((r)=>r.category===label)) }));

  return <main className={styles.page}>
    <header className={styles.header}><div><span>BOATSTRIKERS RESULTS</span><h1>予想実績</h1><p>{label}の公開実績です。</p></div><Link href="/">トップへ戻る</Link></header>
    {total.raceCount === 0 ? <section className={styles.empty}><h2>今月の予想実績は集計中です</h2><p>実績が登録されると、こちらに詳しい成績を表示します。</p></section> : <>
      <section className={styles.summary}>{[["予想レース数",`${total.raceCount}R`],["的中率",`${total.hitRate}%`],["回収率",`${total.returnRate}%`],["最高払戻",`${total.maxPayout.toLocaleString()}円`]].map(([k,v])=><div key={k}><span>{k}</span><strong>{v}</strong></div>)}</section>
      <section className={styles.members}>{members.map((m)=><article key={m.label}><h2>{m.label}</h2><p>{m.raceCount}R中 {m.hitCount}R的中</p><b>的中率 {m.hitRate}%</b><b>回収率 {m.returnRate}%</b></article>)}</section>
      <section className={styles.history}><h2>今月の実績一覧</h2><div className={styles.tableWrap}><table><thead><tr><th>日付</th><th>担当</th><th>レース</th><th>買い目</th><th>投資</th><th>払戻</th><th>結果</th></tr></thead><tbody>{rows.map((r)=><tr key={r.id}><td>{r.race_date}</td><td>{r.category}</td><td>{r.place} {r.race_no}R</td><td>{r.bet_text || "—"}</td><td>{Number(r.invest||0).toLocaleString()}円</td><td>{Number(r.payout||0).toLocaleString()}円</td><td><span className={(r.hit||Number(r.payout)>0)?styles.hit:styles.miss}>{(r.hit||Number(r.payout)>0)?"的中":"不的中"}</span></td></tr>)}</tbody></table></div></section>
    </>}
  </main>;
}
