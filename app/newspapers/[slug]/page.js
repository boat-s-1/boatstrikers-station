import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getPublishedNewspaper } from "../../../lib/newspapers";
import { NEWSPAPER_CHARACTERS } from "../../../lib/newspaperContent";
import NewspaperAnalytics from "../NewspaperAnalytics";
import styles from "../newspapers.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const getNewspaperCached = cache(getPublishedNewspaper);

function renderBody(body) {
  const blocks = String(body || "").split(/\n\n+/).filter(Boolean);
  return blocks.map((block, index) => block.startsWith("## ") ? <h2 key={index}>{block.slice(3)}</h2> : block.split("\n").every((line) => line.startsWith("- ")) ? <ul key={index}>{block.split("\n").map((line) => <li key={line}>{line.slice(2)}</li>)}</ul> : <p key={index}>{block}</p>);
}

export async function generateMetadata({ params }) {
  const { slug } = await params; const item = await getNewspaperCached(decodeURIComponent(slug));
  if (!item) return { title: "新聞が見つかりません｜BoatStrikers" };
  return { title: `${item.title}｜BoatStrikers`, description: item.summary || `${item.course_name}${item.race_no}Rの予想新聞` };
}

export default async function NewspaperDetailPage({ params }) {
  const { slug } = await params; const item = await getNewspaperCached(decodeURIComponent(slug)); if (!item) notFound();
  const character = NEWSPAPER_CHARACTERS[item.character_key] || NEWSPAPER_CHARACTERS.ichika;
  return <main className={styles.page}><article className={styles.article}>
    <NewspaperAnalytics slug={item.slug} character={item.character_key} edition={item.edition} />
    <Link className={styles.back} href="/newspapers">← 予想新聞一覧</Link>
    <header className={styles.articleHead}><div className={styles.meta}>{character.emoji} {character.name}新聞・{item.race_date}・{item.course_name}{item.race_no}R・{item.edition === "just_before" ? "直前版" : "前日版"}</div><h1>{item.title}</h1>{item.summary && <p>{item.summary}</p>}</header>
    {item.image_url && <img className={styles.cover} src={item.image_url} alt={item.title} />}
    <section className={styles.body}>{renderBody(item.article_body)}<div className={styles.actions}><Link data-newspaper-member="1" className={styles.primary} href="/members">無料会員になる</Link>{item.note_url && <a data-newspaper-note="1" className={styles.note} href={item.note_url} target="_blank" rel="noopener noreferrer">詳しい解説をnoteで読む</a>}</div><p className={styles.disclaimer}>舟券の購入は20歳になってから。予想・データは的中や利益を保証するものではありません。</p></section>
  </article></main>;
}
