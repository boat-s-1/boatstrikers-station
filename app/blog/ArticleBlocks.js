import Image from 'next/image';
import Link from 'next/link';
import { BLOG_CHARACTERS, characterImage, poseLabel } from '../../lib/blog/characterAssets.mjs';
import { safeLink } from '../../lib/blog/document.mjs';
import { safeArticleLink, speechPresentation, resolveRelated } from '../../lib/blog/articleModel.mjs';
import s from './article.module.css';
const label = (value, fallback='') => typeof value === 'string' ? value : fallback;
export function PlainText({text}) {
  return label(text).split(/\n\s*\n/).filter(Boolean).map((p,i)=><p key={i} className={s.paragraph}>{p}</p>);
}
function Source({data}) {
  return safeArticleLink(data.source_url)?<p className={s.sourceLine}>出典・参考：<a href={data.source_url} target={data.source_url.startsWith('https:')?'_blank':undefined} rel="noopener noreferrer">{label(data.source_label,data.source_url)}</a></p>:null;
}
export function ArticleImage({media,alt,caption,priority=false}) {
  if (!media || !safeLink(media.public_path)) return null;
  const width=Number.isInteger(media.width)&&media.width>0?media.width:1200;
  const height=Number.isInteger(media.height)&&media.height>0?media.height:675;
  return <figure className={s.figure}><Image src={media.public_path} alt={label(alt,label(media.alt))} width={width} height={height}
    sizes="(max-width: 760px) calc(100vw - 40px), 760px" priority={priority} unoptimized={media.public_path.startsWith('https:')||media.public_path.startsWith('/api/')}/>
    {caption?<figcaption>{label(caption)}</figcaption>:null}{media.source?<p className={s.imageCredit}>{label(media.source)}</p>:null}</figure>;
}
function Speech({turn,previous}) {
  const view=speechPresentation(turn,previous);
  if(!view) return null;
  const character=BLOG_CHARACTERS[turn.character];
  const tone=character.owner||turn.character;
  return <div className={`${s.talk} ${s[tone]} ${view.alignment==='right'?s.right:''} ${view.compact?s.compact:''} ${view.kind==='mate'?s.mate:''}`}
    data-speaker={turn.character} data-pose={turn.pose} data-pose-meaning={poseLabel(turn.character,turn.pose)} data-compact={view.compact?'true':undefined}>
    <Image className={s.characterPortrait} src={characterImage(turn.character,turn.pose)} alt="" width={88} height={114} sizes={view.kind==='mate'?'(max-width: 760px) 40px, 48px':'(max-width: 760px) 54px, 88px'}/>
    <div className={s.speech}><span className={s.characterName}>{view.name}{view.compact?<small> 続き</small>:null}{view.kind==='mate'?<small> AI MATE · DATA CHECK</small>:null}</span>{view.kind==='mate'&&!view.compact?<span className={s.mateRole}>{character.role}</span>:null}<div className={s.bubble}><PlainText text={turn.text}/></div></div>
  </div>;
}
export function RelatedLinks({data,relatedPosts=[],heading=true}) {
  const items=resolveRelated(data,relatedPosts);
  if(!items.length) return null;
  return <section className={s.relatedBlock}>{heading?<h3>あわせて読みたい</h3>:null}<div className={s.relatedGrid}>{items.map((p,i)=><Link key={`${p.href}-${i}`} href={p.href} prefetch={false} className={s.relatedCard}><span className={s.kicker}>{p.existing?'BOATSTRIKERS GUIDE':'BLOG ARTICLE'}</span><strong>{p.title}</strong>{p.excerpt?<p>{p.excerpt}</p>:null}<span className={s.readArrow}>読む →</span></Link>)}</div></section>;
}
export function ArticleBlocks({blocks,media={},relatedPosts=[]}) {
  return blocks.map((b,i)=>{
    const d=b.data, previous=blocks[i-1];
    let node;
    switch(b.type) {
      case 'TEXT': node=<PlainText text={d.text}/>; break;
      case 'HEADING': node=d.level===3?<h3 className={s.bodyH3} id={`section-${b.id}`}>{d.text}</h3>:<h2 className={s.bodyH2} id={`section-${b.id}`}>{d.text}</h2>;break;
      case 'IMAGE': node=<ArticleImage media={media[d.media_id]} alt={d.alt} caption={d.caption}/>;break;
      case 'DIALOGUE': case 'AI_MATE': node=<Speech turn={d} previous={['DIALOGUE','AI_MATE'].includes(previous?.type)?previous.data:null}/>;break;
      case 'DIALOGUE_SCENE': node=<div className={s.scene} role="group" aria-label={label(d.label,'キャラクターの会話')}><span className={s.sceneLabel}>{label(d.label,'3人の視点')}</span>{d.turns.map((turn,j)=><Speech key={turn.id} turn={turn} previous={d.turns[j-1]}/>)}</div>;break;
      case 'DATA_CHECK': case 'POINT': case 'WARNING': node=<aside className={`${s.note} ${b.type==='WARNING'?s.warning:b.type==='POINT'?s.point:s.dataCheck}`}><span className={s.kicker}>{b.type==='WARNING'?'NOTE / 注意事項':b.type==='POINT'?'POINT':'DATA CHECK'}</span>{d.title?<h3>{label(d.title)}</h3>:null}<PlainText text={d.text}/><Source data={d}/></aside>;break;
      case 'QUOTE': node=<blockquote className={s.quote}><PlainText text={d.text}/>{d.attribution?<cite>{label(d.attribution)}</cite>:null}<Source data={d}/></blockquote>;break;
      case 'CTA': node=safeArticleLink(d.href)?<aside className={s.inlineCta}>{d.text?<PlainText text={d.text}/>:null}<Link href={d.href} prefetch={false}>{label(d.label,'BoatStrikersで詳しく見る')} <span aria-hidden="true">↗</span></Link></aside>:null;break;
      case 'RELATED_ARTICLES': node=<RelatedLinks data={d} relatedPosts={relatedPosts}/>;break;
      case 'RACE_LINK': node=safeArticleLink(d.href)?<aside className={s.raceLink}><span className={s.kicker}>RACE LINK</span><p>{d.race_date} · {d.race_no}R</p><Link href={d.href} prefetch={false}>{label(d.label,'関連レースを見る')} ↗</Link></aside>:null;break;
      case 'LIST': node=<ul className={s.list}>{d.items.map((item,j)=><li key={j}>{item}</li>)}</ul>;break;
      case 'TABLE': node=<div className={s.tableScroll} role="region" aria-label={label(d.caption,'記事のデータ表')} tabIndex={0}><table>{d.caption?<caption>{label(d.caption)}</caption>:null}{d.rows.map((row,j)=>j===0&&d.header!==false?<thead key={j}><tr>{row.map((cell,k)=><th scope="col" key={k}>{cell}</th>)}</tr></thead>:<tbody key={j}><tr>{row.map((cell,k)=><td key={k}>{cell}</td>)}</tr></tbody>)}</table></div>;break;
      case 'YOUTUBE': node=safeArticleLink(d.href)?<p className={s.videoLink}><a href={d.href} target="_blank" rel="noopener noreferrer">{label(d.label,'動画を見る')} ↗</a></p>:null;break;
      default: node=null;
    }
    return node?<div className={s.block} key={b.id} data-block-type={b.type}>{node}</div>:null;
  });
}
