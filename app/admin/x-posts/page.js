import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import styles from "./page.module.css";
import PostEditor from "./PostEditor";
import MetricsEditor from "./MetricsEditor";
import { generateCharacterDrafts } from "./generate";
import { generateResultDrafts } from "./generate-results";
import { generateDataLabDraft } from "./generate-data-lab";
import { generateDailyPlan } from "./generate-daily-plan";
import { regenerateCharacterDrafts } from "./actions";
import { getXPostDiagnostics } from "./diagnostics";
export const dynamic="force-dynamic";
const ACCOUNTS=[{id:"official",name:"BoatStrikers",role:"総合・NEWS・DATA LAB",target:6},{id:"ichika",name:"一果",role:"イン逃げ・1号艇",target:2},{id:"hatsune",name:"初音",role:"女子戦・女子レーサー",target:2},{id:"kiina",name:"キイナ",role:"穴・5アタマ・万舟",target:2}];
const LABELS={ichika:"一果",hatsune:"初音",kiina:"キイナ"};
const CATEGORY_LABELS={prediction:"予想",result:"結果",news:"NEWS",data_lab:"DATA LAB",character_chat:"会話・小ネタ",beginner:"初心者講座",announcement:"告知"};
function db(){return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})}
function jstToday(){return new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function localValue(v){if(!v)return"";return new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(v)).replace(" ","T")}
function engagement(m){const imp=Number(m.impressions||0);if(!imp)return 0;return ((Number(m.likes||0)+Number(m.reposts||0)+Number(m.replies||0)+Number(m.bookmarks||0))/imp)*100}
function metricsSummary(metrics){
 if(!metrics.length)return {count:0,avgImp:0,avgEng:0,best:null};
 const avgImp=Math.round(metrics.reduce((s,m)=>s+Number(m.impressions||0),0)/metrics.length);
 const avgEng=metrics.reduce((s,m)=>s+engagement(m),0)/metrics.length;
 const groups={};for(const m of metrics){const k=m.category||"other";(groups[k]||=[]).push(m)}
 const ranked=Object.entries(groups).map(([category,rows])=>({category,count:rows.length,eng:rows.reduce((s,m)=>s+engagement(m),0)/rows.length,imp:rows.reduce((s,m)=>s+Number(m.impressions||0),0)/rows.length})).sort((a,b)=>b.eng-a.eng);
 return {count:metrics.length,avgImp,avgEng,best:ranked[0]||null};
}
export default async function XPostsAdmin({searchParams}){
 const params=await searchParams;const client=db();
 const [{data,error},{data:metrics, error:metricsError},diag]=await Promise.all([
  client.from("bs_x_post_drafts").select("id,account_code,category,title,body,status,scheduled_at,posted_at,created_at,source_kind,source_refs").order("created_at",{ascending:false}).limit(60),
  client.from("bs_x_post_metrics").select("draft_id,account_code,category,post_date,impressions,likes,reposts,replies,bookmarks,profile_visits,link_clicks,follows,notes,recorded_at").order("recorded_at",{ascending:false}).limit(200),
  getXPostDiagnostics()
 ]);
 const posts=(data||[]).map(p=>({...p,scheduled_local:localValue(p.scheduled_at)}));const counts=ACCOUNTS.reduce((a,x)=>{a[x.id]=posts.filter(p=>p.account_code===x.id&&p.status!=="posted").length;return a},{});
 const metricRows=metrics||[];const metricMap=new Map(metricRows.map(m=>[String(m.draft_id),m]));const ms=metricsSummary(metricRows);
 return <main className={styles.page}><div className={styles.shell}>
 <header className={styles.hero}><div><span className={styles.eyebrow}>BOATSTRIKERS SOCIAL STUDIO</span><h1>X投稿センター</h1><p>{jstToday()}｜生成 → 確認 → 編集 → コピー → 投稿済み管理を一画面で行います。</p></div><Link href="/admin" className={styles.back}>← 管理TOP</Link></header>
 <section className={styles.notice}><strong>安全運用モード</strong><p>Xへ自動投稿はしません。DBの確定データから投稿案を作り、人が確認してから利用します。TRINITY本体は変更しません。</p></section>
 <section className={styles.accounts}>{ACCOUNTS.map(a=><article key={a.id} className={styles.accountCard}><span>{a.name}</span><strong>{counts[a.id]||0}件 確認中</strong><small>目安 {a.target}投稿/日｜{a.role}</small></article>)}</section>
 <section className={styles.panel}><div className={styles.panelHead}><div><span>LEARNING</span><h2>X反応から伸びた型を学ぶ</h2></div></div>{metricsError?<p>反応分析テーブルはまだ未適用です。migration「20260929_bs_x_post_metrics.sql」をSupabaseへ適用すると利用できます。</p>:<><div className={styles.accounts}><article className={styles.accountCard}><span>記録済み</span><strong>{ms.count}投稿</strong><small>サンプル数</small></article><article className={styles.accountCard}><span>平均表示</span><strong>{ms.avgImp.toLocaleString()}回</strong><small>記録投稿の平均</small></article><article className={styles.accountCard}><span>平均反応率</span><strong>{ms.avgEng.toFixed(2)}%</strong><small>いいね+RP+返信+保存 ÷ 表示</small></article>{ms.best?<article className={styles.accountCard}><span>反応率トップ型</span><strong>{CATEGORY_LABELS[ms.best.category]||ms.best.category}</strong><small>{ms.best.count}件 / 平均 {ms.best.eng.toFixed(2)}%</small></article>:null}</div><p>投稿済みにした記事で「X反応を記録」を開き、表示回数・いいね・リポスト・プロフィール遷移などを入力します。記録が増えるほど、どのアカウント・カテゴリ・投稿型が伸びるか比較できます。</p></>}</section>
 <section className={styles.panel}><div className={styles.panelHead}><div><span>DIAGNOSTICS</span><h2>生成データ診断</h2></div></div><p><strong>対象日: {diag.date}</strong>｜{diag.message}</p>{diag.characters?.length?<div className={styles.accounts}>{diag.characters.map(c=><article key={c.code} className={styles.accountCard}><span>{LABELS[c.code]}</span><strong>{c.total}件 / 生成候補 {c.eligible}件</strong><small>{c.top?`先頭候補 ${c.top}`:"生成対象なし"}</small></article>)}</div>:null}</section>
 {params?.gen?<section className={styles.notice}><strong>{params.gen==="ok"?"生成完了":"生成結果"}</strong><p>{params.message||"処理が完了しました。"}{params.created?`｜作成 ${params.created}件`:""}{params.skipped?`｜重複 ${params.skipped}件`:""}</p></section>:null}
 <section className={styles.panel}><div className={styles.panelHead}><div><span>DAILY PLAN</span><h2>4アカウントの1日分を作る</h2></div></div><div className={styles.links}><form action={generateDailyPlan}><button type="submit">今日の運用投稿をまとめて生成・更新</button></form></div><p>当日の開催データとキャラ別ランキングから投稿案を作成します。未投稿の同日案は最新データで更新し、投稿済みは変更しません。</p></section>
 <section className={styles.panel}><div className={styles.panelHead}><div><span>GENERATE</span><h2>データ連動投稿を作る</h2></div></div><div className={styles.links}><form action={generateCharacterDrafts}><button type="submit">3キャラの今日の予想案</button></form><form action={regenerateCharacterDrafts}><button type="submit">今日の3キャラ下書きを新テンプレで更新</button></form><form action={generateResultDrafts}><button type="submit">公開予想の結果・答え合わせ案</button></form><form action={generateDataLabDraft}><button type="submit">昨日のDATA LAB公式投稿案</button></form></div><p>再生成は今日の未投稿下書きだけを更新します。投稿済みの内容は変更しません。</p></section>
 <section className={styles.panel}><div className={styles.panelHead}><div><span>DRAFTS</span><h2>投稿案</h2></div><div className={styles.count}>{posts.length}件</div></div>{error?<p>下書き取得エラー: {error.message}</p>:null}<div className={styles.list}>{posts.length?posts.map(post=><article className={styles.postRow} key={post.id}><time>{post.scheduled_at?new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",hour:"2-digit",minute:"2-digit"}).format(new Date(post.scheduled_at)):"未定"}</time><div className={styles.postMain}><div className={styles.meta}><span>{ACCOUNTS.find(a=>a.id===post.account_code)?.name||post.account_code}</span><em>{CATEGORY_LABELS[post.category]||post.category}</em><em>{post.status}</em></div><PostEditor post={post} accounts={ACCOUNTS}/><MetricsEditor post={post} metric={metricMap.get(String(post.id))}/></div></article>):<p>まだ投稿案がありません。診断結果を確認してから生成ボタンを押してください。</p>}</div></section>
 <section className={styles.panel}><div className={styles.panelHead}><div><span>MANUAL</span><h2>新しい投稿案</h2></div></div><PostEditor accounts={ACCOUNTS}/></section>
 </div></main>;
}
