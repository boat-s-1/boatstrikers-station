import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublishedMagazineIssue } from '../../../../lib/magazineData';
import styles from './issue.module.css';

export const dynamic='force-dynamic';

function paragraphs(text=''){return String(text).split(/\n{2,}|\n/).filter(Boolean)}
function icon(type){return ({intro:'💡',comic:'🎨',ichika:'⚓',hatsune:'🌸',kiina:'⭐',ai:'🤖',example:'🏁',checklist:'✅',summary:'📘',free:'📖'})[type]||'📖'}
function label(type){return ({intro:'今回の結論',comic:'今週の漫画',ichika:'一果のイン逃げ鉄板ゼミ',hatsune:'初音の女子戦研究室',kiina:'キイナの穴党塾',ai:'AI研究室',example:'実例レース',checklist:'今日から使えるチェックリスト',summary:'まとめ・次号予告',free:'特集'})[type]||'特集'}

export async function generateMetadata({params}){const {slug}=await params;const issue=await getPublishedMagazineIssue(slug);if(!issue)return{};return{title:`${issue.volume} ${issue.title}｜BoatStrikers Weekly`,description:issue.summary||issue.subtitle,openGraph:{title:issue.title,description:issue.summary,images:issue.cover_image_url?[issue.cover_image_url]:[]}}}

export default async function IssuePage({params}){const {slug}=await params;const issue=await getPublishedMagazineIssue(slug);if(!issue)notFound();const sections=Array.isArray(issue.sections)?issue.sections:[];return <main className={styles.page} style={{'--theme':issue.theme_color||'#0c3f78','--accent':issue.accent_color||'#ff4f87'}}>
 <header className={styles.cover}>{issue.cover_image_url&&<img src={issue.cover_image_url} alt={issue.title}/>}<div className={styles.coverShade}/><div className={styles.coverText}><span>BoatStrikers Weekly　{issue.volume}</span><h1>{issue.title}</h1>{issue.subtitle&&<p>{issue.subtitle}</p>}<small>{issue.published_at?new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',dateStyle:'long'}).format(new Date(issue.published_at)):''}</small></div></header>
 <section className={styles.toc}><div><span>CONTENTS</span><h2>今号の目次</h2></div><ol>{sections.map((s,i)=><li key={s.id||i}><a href={`#section-${i}`}><b>{String(i+1).padStart(2,'0')}</b><span>{s.title||label(s.type)}</span></a></li>)}</ol></section>
 <article className={styles.magazine}>{sections.map((s,i)=><section id={`section-${i}`} className={`${styles.section} ${styles[s.type]||''}`} key={s.id||i}><div className={styles.number}>{String(i+1).padStart(2,'0')}</div><div className={styles.sectionHead}><small>{icon(s.type)} {s.kicker||label(s.type)}</small><h2>{s.title||label(s.type)}</h2></div>{s.image_url&&<figure><img src={s.image_url} alt={s.caption||s.title||''}/>{s.caption&&<figcaption>{s.caption}</figcaption>}</figure>}<div className={styles.prose}>{paragraphs(s.body).map((p,n)=><p key={n}>{p}</p>)}</div>{Array.isArray(s.points)&&s.points.filter(Boolean).length>0&&<ul className={styles.points}>{s.points.filter(Boolean).map((p,n)=><li key={n}>{p}</li>)}</ul>}{s.next_issue&&<div className={styles.next}><small>NEXT ISSUE</small><strong>{s.next_issue}</strong></div>}</section>)}</article>
 <footer className={styles.footer}><p>BoatStrikers Weekly</p><Link href="/library/weekly">← バックナンバーへ</Link><Link href="/library">図書館へ →</Link></footer>
 </main>}
