import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublishedMagazineIssue } from '../../../../lib/magazineData';
import styles from './issue.module.css';

export const dynamic='force-dynamic';

function paras(text=''){return String(text).split(/\n{2,}|\n/).filter(Boolean)}
function typeName(type){return ({lead:'FEATURE',image:'VISUAL',article:'ARTICLE',speech:'TALK',point:'POINT',ai:'AI LAB',comparison:'CASE STUDY',checklist:'CHECK LIST',ranking:'RANKING',quote:'COLUMN',divider:'CHAPTER',next:'NEXT ISSUE'})[type]||'ARTICLE'}
function Character({name}){const map={ichika:['一果','イン逃げ担当'],hatsune:['初音','女子戦担当'],kiina:['キイナ','穴党担当'],editor:['編集部','BoatStrikers']};const [n,r]=map[name]||map.ichika;return <div className={`${styles.avatar} ${styles[name]||''}`}><span>{n.slice(0,1)}</span><div><b>{n}</b><small>{r}</small></div></div>}
function Points({items=[],ranking=false}){const rows=items.filter(Boolean);if(!rows.length)return null;return <ol className={`${styles.points} ${ranking?styles.ranking:''}`}>{rows.map((p,i)=><li key={i}><b>{ranking?String(i+1).padStart(2,'0'):'✓'}</b><span>{p}</span></li>)}</ol>}
function Metrics({items=[]}){return <div className={styles.metrics}>{items.filter(x=>x.label||x.value).map((m,i)=><div key={i}><small>{m.label}</small><strong>{m.value}</strong>{m.note&&<p>{m.note}</p>}</div>)}</div>}
function Heading({s,index}){return <header className={styles.blockHeading}>{s.badge&&<span className={styles.badge}>{s.badge}</span>}<small>{s.kicker||typeName(s.type)}</small>{s.title&&<h2>{s.title}</h2>}<i>{String(index+1).padStart(2,'0')}</i></header>}
function Body({s}){return <div className={styles.prose}>{paras(s.body).map((p,i)=><p key={i}>{p}</p>)}</div>}
function Figure({url,caption,alt}){return url?<figure><img src={url} alt={alt||''}/>{caption&&<figcaption>{caption}</figcaption>}</figure>:null}
function MagazineBlock({s,index}){
 const layout=styles[s.layout]||'';
 if(s.type==='divider')return <section id={`section-${index}`} className={`${styles.chapter} ${layout}`}><small>{s.kicker||`CHAPTER ${String(index+1).padStart(2,'0')}`}</small><h2>{s.title}</h2></section>;
 if(s.type==='image')return <section id={`section-${index}`} className={`${styles.visual} ${layout}`}><Figure url={s.image_url} caption={s.caption} alt={s.title}/></section>;
 if(s.type==='speech')return <section id={`section-${index}`} className={`${styles.speech} ${styles[s.character]||''}`}><Character name={s.character}/><div><Heading s={s} index={index}/><Body s={s}/></div></section>;
 if(s.type==='quote')return <section id={`section-${index}`} className={styles.quote}><Heading s={s} index={index}/><blockquote>{s.body}</blockquote></section>;
 if(s.type==='next')return <section id={`section-${index}`} className={styles.next}><small>NEXT ISSUE</small><h2>{s.next_issue||s.title}</h2><p>{s.body}</p></section>;
 if(s.type==='lead')return <section id={`section-${index}`} className={`${styles.lead} ${layout}`}><div><Heading s={s} index={index}/><Body s={s}/><Points items={s.points}/></div><Figure url={s.image_url} caption={s.caption} alt={s.title}/></section>;
 if(s.type==='comparison')return <section id={`section-${index}`} className={`${styles.paper} ${styles.comparison} ${layout}`}><Heading s={s} index={index}/><div className={styles.compareGrid}><Figure url={s.image_url} caption={s.caption} alt={s.title}/><Figure url={s.image_url_2} alt={s.title}/></div><Body s={s}/></section>;
 return <section id={`section-${index}`} className={`${styles.paper} ${styles[s.type]||''} ${layout}`}><Heading s={s} index={index}/>{s.type==='ai'&&<Metrics items={s.metrics||[]}/>}<div className={styles.articleGrid}><Figure url={s.image_url} caption={s.caption} alt={s.title}/><div><Body s={s}/><Points items={s.points} ranking={s.type==='ranking'}/></div></div></section>;
}

export async function generateMetadata({params}){const {slug}=await params;const issue=await getPublishedMagazineIssue(slug);if(!issue)return{};return{title:`${issue.volume} ${issue.title}｜BoatStrikers Weekly`,description:issue.summary||issue.subtitle,openGraph:{title:issue.title,description:issue.summary,images:issue.cover_image_url?[issue.cover_image_url]:[]}}}

export default async function IssuePage({params}){const {slug}=await params;const issue=await getPublishedMagazineIssue(slug);if(!issue)notFound();const sections=Array.isArray(issue.sections)?issue.sections:[];return <main className={styles.page} style={{'--theme':issue.theme_color||'#0c3f78','--accent':issue.accent_color||'#ff4f87'}}>
 <header className={styles.cover}>{issue.cover_image_url&&<img src={issue.cover_image_url} alt={issue.title}/>}<div className={styles.coverShade}/><div className={styles.masthead}><b>BoatStrikers</b><span>WEEKLY</span></div><div className={styles.issueNo}>{issue.volume}</div><div className={styles.coverText}><small>BOAT RACE ENTERTAINMENT MAGAZINE</small><h1>{issue.title}</h1>{issue.subtitle&&<p>{issue.subtitle}</p>}<div>{issue.published_at?new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',dateStyle:'long'}).format(new Date(issue.published_at)):''}</div></div></header>
 <section className={styles.toc}><header><small>CONTENTS</small><h2>今号のラインナップ</h2><p>{issue.summary}</p></header><ol>{sections.map((s,i)=><li key={s.id||i}><a href={`#section-${i}`}><b>{String(i+1).padStart(2,'0')}</b><span>{s.title||typeName(s.type)}</span><i>→</i></a></li>)}</ol></section>
 <article className={styles.magazine}>{sections.map((s,i)=><MagazineBlock s={s} index={i} key={s.id||i}/>)}</article>
 <footer className={styles.footer}><div><b>BoatStrikers Weekly</b><small>毎週、ボートレースをもっと楽しく、もっと深く。</small></div><Link href="/library/weekly">← バックナンバー</Link><Link href="/library">図書館へ →</Link></footer>
 </main>}
