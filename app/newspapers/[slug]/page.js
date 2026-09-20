import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getPublishedNewspaper, getPublishedNewspapers } from "../../../lib/newspapers";
import { NEWSPAPER_CHARACTERS } from "../../../lib/newspaperContent";
import { getCourseName } from "../../lib/boatstrikersPlatform";
import NewspaperAnalytics from "../NewspaperAnalytics";
import styles from "../newspapers.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const getNewspaperCached = cache(getPublishedNewspaper);

const THEME_META = {
  ichika: { key:"ichika", room:"/ichika", role:"イン逃げ", kicker:"ICHIKA NEWSPAPER", label:"一果のイン逃げ予想", roomLabel:"一果の部屋へ", emoji:"🌿" },
  hatsune: { key:"hatsune", room:"/hatsune", role:"女子戦", kicker:"HATSUNE NEWSPAPER", label:"初音の女子戦予想", roomLabel:"初音の部屋へ", emoji:"💜" },
  kiina: { key:"kiina", room:"/kiina", role:"穴狙い", kicker:"KIINA NEWSPAPER", label:"キイナの穴狙い予想", roomLabel:"キイナの部屋へ", emoji:"💛" },
};

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
  const theme = THEME_META[item.character_key] || THEME_META.ichika;
  const racePapers = await getPublishedNewspapers({
    date: item.race_date,
    course: item.course_name,
    raceNo: item.race_no,
    limit: 20,
  });
  const siblingEdition = racePapers.find((paper) =>
    paper.character_key === item.character_key &&
    paper.slug !== item.slug &&
    paper.edition !== item.edition
  ) || null;
  const courseCode = Array.from({ length: 24 }, (_, index) => index + 1)
    .find((code) => getCourseName(code) === item.course_name);
  const raceHref = courseCode
    ? `/races/${String(courseCode).padStart(2, "0")}/${item.race_no}?date=${item.race_date}`
    : `/races?date=${item.race_date}`;

  const related = (await getPublishedNewspapers({ character: item.character_key, limit: 4 }))
    .filter((paper) => paper.slug !== item.slug)
    .slice(0, 3);
  const editionLabel = item.edition === "just_before" ? "直前版" : "前日版";

  return <main className={`${styles.page} ${styles[`theme_${theme.key}`]}`}>
    <article className={styles.article}>
      <NewspaperAnalytics slug={item.slug} character={item.character_key} edition={item.edition} />

      <div className={styles.topNav}>
        <Link className={styles.back} href="/newspapers">← 予想新聞一覧</Link>
        <Link className={styles.roomLink} href={theme.room}>{theme.roomLabel} →</Link>
      </div>

      <header className={styles.characterHero}>
        <div className={styles.heroTop}>
          <div>
            <span className={styles.kicker}>{theme.kicker}</span>
            <div className={styles.heroTags}>
              <b>{theme.emoji} {theme.role}</b>
              <b>{editionLabel}</b>
              <b>{item.course_name}{item.race_no}R</b>
            </div>
          </div>
          <div className={styles.characterSeal}>{character.name}</div>
        </div>
        <p className={styles.characterLabel}>{theme.label}</p>
        <h1>{item.title}</h1>
        {item.summary && <p className={styles.summary}>{item.summary}</p>}
      </header>

      <section className={styles.raceBridge}>
        <div className={styles.raceBridgeMain}>
          <span>RACE LINK</span>
          <strong>{item.course_name}{item.race_no}Rの最新レース情報</strong>
          <p>出走表・展示・AI情報を確認できます。</p>
        </div>
        <Link className={styles.raceBridgeButton} href={raceHref}>出走表・展示を見る →</Link>
      </section>

      {siblingEdition && <section className={`${styles.editionBridge} ${item.edition === "previous_day" ? styles.editionBridgeUpdate : ""}`}>
        <div>
          <span>{item.edition === "previous_day" ? "UPDATE AVAILABLE" : "RELATED EDITION"}</span>
          <strong>{item.edition === "previous_day" ? "直前版が公開されています" : "このレースの前日版も読めます"}</strong>
          <p>{siblingEdition.course_name}{siblingEdition.race_no}R・{siblingEdition.edition === "just_before" ? "直前版" : "前日版"}・{character.name}新聞</p>
        </div>
        <Link href={`/newspapers/${siblingEdition.slug}`}>{siblingEdition.edition === "just_before" ? "直前版を見る" : "前日版を見る"} →</Link>
      </section>}

      {item.image_url && <figure className={styles.coverWrap}>
        <img className={styles.cover} src={item.image_url} alt={item.title} />
        <figcaption>{item.race_date}・{item.course_name}{item.race_no}R・{editionLabel}</figcaption>
      </figure>}

      <section className={styles.body}>
        {renderBody(item.article_body)}
        <div className={styles.actions}>
          <Link className={styles.raceAction} href={raceHref}>このレースの出走表・展示を見る</Link>
          <Link className={styles.characterButton} href={theme.room}>{theme.roomLabel}</Link>
          {item.note_url && <a data-newspaper-note="1" className={styles.note} href={item.note_url} target="_blank" rel="noopener noreferrer">詳しい解説をnoteで読む</a>}
          <Link data-newspaper-member="1" className={styles.primary} href="/members">無料会員になる</Link>
        </div>
        <p className={styles.disclaimer}>舟券の購入は20歳になってから。予想・データは的中や利益を保証するものではありません。</p>
      </section>

      {related.length > 0 && <section className={styles.related}>
        <div className={styles.relatedHead}>
          <div><span>MORE NEWSPAPERS</span><h2>最新の{character.name}新聞</h2></div>
          <Link href={`/newspapers?character=${item.character_key}`}>一覧を見る →</Link>
        </div>
        <div className={styles.relatedGrid}>
          {related.map((paper) => <Link className={styles.relatedCard} href={`/newspapers/${paper.slug}`} key={paper.id}>
            {paper.image_url ? <img src={paper.image_url} alt={paper.title} /> : <div className={styles.relatedPlaceholder}>📰</div>}
            <div>
              <small>{paper.edition === "just_before" ? "直前版" : "前日版"}・{paper.course_name}{paper.race_no}R</small>
              <strong>{paper.title}</strong>
              <span>読む ›</span>
            </div>
          </Link>)}
        </div>
      </section>}
    </article>
  </main>;
}
