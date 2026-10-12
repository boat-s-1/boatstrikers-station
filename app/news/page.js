import Link from "next/link";
import { formatHatsuneNewsDate } from "../hatsune/newsData";
import { NEWS_CHARACTERS, NEWS_TABS, newsCharacterNote, normalizeNewsCharacter, normalizeNewsTab } from "../../lib/newsTaxonomy";
import { getNewsListing, parseNewsPage, NEWS_SECTIONS } from "./newsQueries";
import NewsHeadlineRow, { NewsDatedList, NewsMarks } from "./NewsHeadlineRow";
import NewsCharacterFace from "./NewsCharacterFace";
import NewsLoadMore from "./NewsLoadMore";
import { newsListHref } from "./newsLinks";
import theme from "./newsTheme.module.css";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "BoatStrikers NEWS | ボートレース最新ニュース",
  description: "BoatStrikersオリジナル、女子、グレードレース、注目レース、結果、選手情報、公式YouTubeまで。ボートレース情報を目的別にチェック。",
};

const UPDATED_FORMAT = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });

function updatedLabel(value) {
  if (!value) return "";
  const parts = Object.fromEntries(UPDATED_FORMAT.formatToParts(new Date(value)).map((p) => [p.type, p.value]));
  return `${parts.month}/${parts.day}(${parts.weekday}) ${parts.hour}:${parts.minute} 更新`;
}

export default async function NewsTopPage({ searchParams }) {
  const params = await searchParams;
  const category = normalizeNewsTab(params?.category);
  const character = normalizeNewsCharacter(params?.character);
  const q = String(params?.q || "").slice(0, 200);
  const page = parseNewsPage(params?.page);
  const searching = !!q.trim();
  const showSections = category === "all" && !character && !searching && page === 1;
  const listing = await getNewsListing({ category, character, q, page, includeSections: showSections });
  const { featured, items, sections, total, totalPages, tabCounts } = listing;
  const now = Date.now();
  const tabLabel = NEWS_TABS.find((x) => x.key === category)?.label;
  const filterCharacter = character ? NEWS_CHARACTERS[character] : null;
  const listTitle = searching ? "検索結果" : filterCharacter ? `${filterCharacter.name}担当のニュース` : category === "all" ? "最新ニュース" : `${tabLabel}のニュース`;
  const featuredNote = featured?.character ? newsCharacterNote(featured.character) : null;

  return (
    <main className={theme.theme}><div className={theme.shell}>
      <header className={theme.band}>
        <Link href="/news" className={theme.logo}><b>BoatStrikers</b><span>NEWS</span></Link>
        <div className={theme.bandMeta}>
          {listing.updatedAt && <time dateTime={listing.updatedAt}>{updatedLabel(listing.updatedAt)}</time>}
          <a href="#news-search" className={styles.searchIcon} aria-label="ニュースを検索">⌕</a>
        </div>
      </header>
      <div id="news-search" className={`${styles.searchPanel} ${searching ? styles.searchOpen : ""}`}>
        <form className={theme.searchForm} method="get" action="/news">
          <input type="hidden" name="category" value={category} />
          {character && <input type="hidden" name="character" value={character} />}
          <input name="q" defaultValue={q} placeholder="選手名・場名・キーワード（スペースで複数語）" aria-label="検索キーワード" />
          <button type="submit">検索</button>
        </form>
        <p className={theme.searchNote}>全公開記事の見出し・要約・本文・出典・場名から検索します。{searching && <> <Link href={newsListHref({ category, character })}>検索を解除</Link></>}</p>
      </div>

      <nav className={theme.tabs} aria-label="ニュースのカテゴリー">
        {NEWS_TABS.map((tab) => {
          const href = tab.href || newsListHref({ category: tab.key, q });
          const on = !tab.href && category === tab.key && !character;
          return <Link key={tab.key} href={href} className={on ? theme.tabOn : undefined} aria-current={on ? "page" : undefined}>{tab.label}{!tab.href && <small>{tabCounts[tab.key] ?? 0}</small>}</Link>;
        })}
      </nav>

      {filterCharacter && (
        <div className={styles.filterNote}>
          <NewsCharacterFace character={character} size={26} />
          <span><b>{filterCharacter.name}</b>担当（{filterCharacter.role}）の記事に絞り込み中</span>
          <Link href={newsListHref({ category, q })}>解除 ×</Link>
        </div>
      )}

      {featured && (
        <section className={styles.top} aria-label="注目ニュース">
          <div className={styles.kicker}><span className={theme.goldMark}>TOP</span><NewsMarks item={featured} now={now} showNew={false} /><time dateTime={featured.publishedAt || undefined}>{formatHatsuneNewsDate(featured.publishedAt)}</time></div>
          <Link href={`/news/${featured.id}`} className={styles.topLink}><h2>{featured.headline}</h2>{featured.summary && <p>{featured.summary}</p>}</Link>
          {featuredNote && (
            <Link href={newsListHref({ character: featured.character })} className={styles.guideLine}>
              <NewsCharacterFace character={featured.character} size={28} pose="point" />
              <span className={theme.guideLabel}>{featuredNote.label}</span>
              <span className={styles.guideText}>{NEWS_CHARACTERS[featured.character].name}担当の記事一覧（{NEWS_CHARACTERS[featured.character].deskLabel}）</span>
              <b>›</b>
            </Link>
          )}
        </section>
      )}

      {!searching && !character && (
        <nav className={styles.desk} aria-label="編集部の担当別ニュース">
          {Object.values(NEWS_CHARACTERS).map((c) => (
            <Link key={c.key} href={newsListHref({ character: c.key })} className={styles[`desk_${c.key}`]} aria-label={`${c.name}担当（${c.role}）のニュース。直近24時間の新着${listing.recentByCharacter[c.key] ?? 0}本`}>
              <span className={styles.deskFace}>
                <NewsCharacterFace character={c.key} size={32} />
                {listing.recentByCharacter[c.key] > 0 && <em title="直近24時間の新着">{listing.recentByCharacter[c.key]}</em>}
              </span>
              <span className={styles.deskText}><b>{c.name}</b><small>{c.deskLabel}</small></span>
            </Link>
          ))}
        </nav>
      )}

      <section aria-label={listTitle}>
        <div className={theme.listHead}>
          <h2>{listTitle}</h2>
          <span>{category === "all" && !character && !searching ? <>直近24時間 <b>{listing.recentTotal}本</b>・全{listing.allTotal}件</> : <>{searching ? `「${q.trim()}」 ` : ""}{total}件</>}{page > 1 ? `・${page}ページ目` : ""}</span>
        </div>
        {items.length > 0 && <NewsDatedList items={items} now={now} />}
        <NewsLoadMore key={`${category}:${character}:${q}:${page}`} category={category} character={character} q={q} initialPage={page} totalPages={totalPages} lastDayKey={listing.lastDayKey} />
      </section>

      {listing.searchFailed && <div className={theme.empty}>検索に失敗しました。時間をおいて再度お試しください。</div>}
      {!listing.searchFailed && total === 0 && <div className={theme.empty}>該当するニュースはありません。</div>}
      {total > 0 && !featured && items.length === 0 && <div className={theme.empty}>このページに記事はありません。<Link href={newsListHref({ category, character, q })}>1ページ目へ</Link></div>}

      {showSections && NEWS_SECTIONS.map((section) => sections[section.key]?.length > 0 && (
        <section key={section.key} className={styles.section}>
          <div className={theme.listHead}>
            <h3>{section.character && <NewsCharacterFace character={section.character} size={24} />}{section.title}</h3>
            <Link href={newsListHref(section.href)}>すべて見る ›</Link>
          </div>
          <div className={theme.list}>{sections[section.key].map((item) => <NewsHeadlineRow key={item.id} item={item} now={now} timeMode="date" showNew={false} />)}</div>
        </section>
      ))}

      <Link href="/races" className={theme.raceCta}><span>RACE</span><b>今日の出走表・AI予想を見る</b><i>›</i></Link>
    </div></main>
  );
}
