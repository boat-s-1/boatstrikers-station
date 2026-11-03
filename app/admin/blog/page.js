import Link from 'next/link';
import { adminPosts, blogAdminReady, blogWritesReady } from '../../../lib/blog/adminData';
import s from './blogAdmin.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'記事管理 | BOATSTRIKERS BLOG',robots:{index:false,follow:false}};
const date=v=>v?new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v)):'—';
export default async function BlogAdminPage(){
 const ready=blogAdminReady(),writes=blogWritesReady();let posts=[],error='';
 if(ready) try{posts=await adminPosts();}catch{error='記事一覧を取得できません。BLOG検証環境を確認してください。';}
 return <main className={s.page}><header className={s.hero}><p className={s.eyebrow}>BOATSTRIKERS · EDITORIAL</p><div className={s.heroRow}><div><h1>BLOG 記事管理</h1><p>編集版を保存し、確認してから公開する。</p></div><div className={s.heroActions}><Link className={s.button} href="/admin/blog/ai">AI下書き</Link><Link className={s.primary} href="/admin/blog/new">＋ 新しい記事</Link></div></div></header>
 {!ready?<div className={s.notice}>現在のPreviewにはBLOG検証DBが接続されていません。画面構成と新規記事入力を確認できます。保存・公開は検証環境の設定後に利用できます。</div>:!writes?<div className={s.notice}>BLOG書き込みは停止中です。記事の閲覧のみ可能です。</div>:null}
 {error?<p role="alert" className={s.error}>{error}</p>:null}
 {process.env.VERCEL_ENV==='preview'?<p className={s.footnote}><Link href="/blog/preview/dialogue-editor">Preview専用：会話シーン編集をiPhoneで試す →</Link></p>:null}
 <section className={s.panel}><div className={s.panelHeading}><h2>記事一覧</h2><span>{posts.length}件</span></div>{posts.length?<div className={s.cards}>{posts.map(p=><Link key={p.id} className={s.card} href={`/admin/blog/posts/${p.id}`}><div className={s.cardTop}><strong>{p.title}</strong><span className={s.badge}>{p.scheduled_revision_id?'予約':p.state==='published'?'公開中':p.state==='unpublished'?'非公開':'下書き'}</span></div><span className={s.slug}>/{p.slug}</span><dl><div><dt>著者</dt><dd>{p.authors.join('・')||'未設定'}</dd></div><div><dt>カテゴリー</dt><dd>{p.category}</dd></div><div><dt>公開日</dt><dd>{date(p.first_published_at)}</dd></div><div><dt>更新日</dt><dd>{date(p.last_published_at||p.updated_at)}</dd></div></dl></Link>)}</div>:<p className={s.empty}>記事はまだありません。新規記事を作成すると、下書きとしてここに表示されます。</p>}</section><p className={s.footnote}>下書き・予約版・編集版はBLOGの公開ページには表示されません。</p></main>;
}
