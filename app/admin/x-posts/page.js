import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import styles from "./page.module.css";
import PostEditor from "./PostEditor";
import { generateCharacterDrafts } from "./generate";
import { generateResultDrafts } from "./generate-results";
import { generateDataLabDraft } from "./generate-data-lab";

export const dynamic = "force-dynamic";
const ACCOUNTS=[{id:"official",name:"BoatStrikers",role:"総合・NEWS・DATA LAB",target:6},{id:"ichika",name:"一果",role:"イン逃げ・1号艇",target:2},{id:"hatsune",name:"初音",role:"女子戦・女子レーサー",target:2},{id:"kiina",name:"キイナ",role:"穴・5アタマ・万舟",target:2}];
function db(){return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})}
function jstToday(){return new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function localValue(v){if(!v)return"";return new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(v)).replace(" ","T")}
export default async function XPostsAdmin(){
 const {data,error}=await db().from("bs_x_post_drafts").select("id,account_code,category,body,status,scheduled_at,posted_at,created_at,source_type").order("created_at",{ascending:false}).limit(60);
 const posts=(data||[]).map(p=>({...p,scheduled_local:localValue(p.scheduled_at)}));
 const counts=ACCOUNTS.reduce((a,x)=>{a[x.id]=posts.filter(p=>p.account_code===x.id&&p.status!=="posted").length;return a},{});
 return <main className={styles.page}><div className={styles.shell}>
 <header className={styles.hero}><div><span className={styles.eyebrow}>BOATSTRIKERS SOCIAL STUDIO</span><h1>X投稿センター</h1><p>{jstToday()}｜生成 → 確認 → 編集 → コピー → 投稿済み管理を一画面で行います。</p></div><Link href="/admin" className={styles.back}>← 管理TOP</Link></header>
 <section className={styles.notice}><strong>安全運用モード</strong><p>Xへ自動投稿はしません。DBの確定データから投稿案を作り、人が確認してから利用します。TRINITY本体は変更しません。</p></section>
 <section className={styles.accounts}>{ACCOUNTS.map(a=><article key={a.id} className={styles.accountCard}><span>{a.name}</span><strong>{counts[a.id]||0}件 確認中</strong><small>目安 {a.target}投稿/日｜{a.role}</small></article>)}</section>
 <section className={styles.panel}><div className={styles.panelHead}><div><span>GENERATE</span><h2>投稿案を作る</h2></div></div><div className={styles.links}><form action={generateCharacterDrafts}><button type="submit">3キャラの今日の予想案</button></form><form action={generateResultDrafts}><button type="submit">公開予想の結果・答え合わせ案</button></form><form action={generateDataLabDraft}><button type="submit">昨日のDATA LAB公式投稿案</button></form></div><p>予想・結果・DATA LABはいずれも保存済みデータから作成します。結果は不的中も含め、同じ元データの重複生成を抑止します。</p></section>
 <section className={styles.panel}><div className={styles.panelHead}><div><span>DRAFTS</span><h2>投稿案</h2></div><div className={styles.count}>{posts.length}件</div></div>{error?<p>下書き取得エラー: {error.message}</p>:null}<div className={styles.list}>{posts.length?posts.map(post=><article className={styles.postRow} key={post.id}><time>{post.scheduled_at?new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",hour:"2-digit",minute:"2-digit"}).format(new Date(post.scheduled_at)):"未定"}</time><div className={styles.postMain}><div className={styles.meta}><span>{ACCOUNTS.find(a=>a.id===post.account_code)?.name||post.account_code}</span><em>{post.category}</em><em>{post.status}</em></div><PostEditor post={post} accounts={ACCOUNTS}/></div></article>):<p>まだ投稿案がありません。上の生成ボタン、または新規作成から始めてください。</p>}</div></section>
 <section className={styles.panel}><div className={styles.panelHead}><div><span>MANUAL</span><h2>新しい投稿案</h2></div></div><PostEditor accounts={ACCOUNTS}/></section>
 <section className={styles.next}><h2>検証フェーズ</h2><p>予想・結果・DATA LABの主要3系統を接続しました。次はビルド/CIとmainとの差分・競合を確認し、問題を修正してからPRをマージ候補にします。</p><div className={styles.links}><Link href="/admin/ai-candidates">AI候補を確認 →</Link><Link href="/admin/data-lab-social">DATA LAB SNS →</Link></div></section>
 </div></main>;
}
