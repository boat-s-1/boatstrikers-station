import Link from "next/link";
import { getPublishedNewspapers } from "../../lib/newspapers";
import { NEWSPAPER_CHARACTERS } from "../../lib/newspaperContent";
import styles from "./newspapers.module.css";

export const metadata = { title: "予想新聞｜BoatStrikers", description: "一果・初音・キイナの予想新聞。前日版・直前版と過去記事を公式サイトで確認できます。" };
export const revalidate = 60;

export default async function NewspapersPage({ searchParams }) {
  const params = await searchParams;
  const character = ["ichika", "hatsune", "kiina"].includes(params?.character) ? params.character : undefined;
  const items = await getPublishedNewspapers({ character });
  return <main className={styles.page}><div className={styles.shell}>
    <header className={styles.hero}><span>BOATSTRIKERS NEWSPAPER</span><h1>3人の予想新聞</h1><p>前日版から直前版、レース後の振り返りまで。最新号と過去新聞をBoatStrikers内でまとめて確認できます。</p></header>
    <nav className={styles.filters}><Link href="/newspapers">すべて</Link>{Object.entries(NEWSPAPER_CHARACTERS).map(([key, item]) => <Link href={`/newspapers?character=${key}`} key={key}>{item.emoji} {item.name}</Link>)}<Link href="/library">図書館へ</Link></nav>
    {items.length ? <section className={styles.grid}>{items.map((item) => <Link className={styles.card} href={`/newspapers/${item.slug}`} key={item.id}>{item.image_url ? <img src={item.image_url} alt={item.title} /> : <div style={{aspectRatio:"9/16",display:"grid",placeItems:"center",background:"#edf2f6",fontSize:42}}>📰</div>}<div className={styles.cardBody}><span>{item.race_date}・{item.course_name}{item.race_no}R・{item.edition === "just_before" ? "直前版" : "前日版"}</span><h2>{item.title}</h2><p>{item.summary || "新聞の詳細を見る"}</p></div></Link>)}</section> : <p className={styles.empty}>公開中の新聞はまだありません。管理画面で「公開」にすると、ここに表示されます。</p>}
  </div></main>;
}
