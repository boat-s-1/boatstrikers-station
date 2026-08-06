import Parser from 'rss-parser';
import { STADIUMS, stadiumPath } from '../../../lib/stadiums';
import StadiumDirectoryClient from './StadiumDirectoryClient';
import styles from './stadiums.module.css';

const FALLBACK_COVER = '/book-24-stadiums.jpg';

function cleanArticleTitle(title = '', place = '') {
  return title
    .replace(new RegExp(`【${place}場攻略】`, 'g'), '')
    .replace(/^[\s　・｜|:-]+|[\s　・｜|:-]+$/g, '')
    .trim();
}

async function getLatestStadiumArticles() {
  try {
    const parser = new Parser();
    const feed = await parser.parseURL('https://note.com/boat_strikers/rss');

    return feed.items
      .filter((item) =>
        STADIUMS.some((stadium) =>
          item.title?.includes(`【${stadium.name}場攻略】`)
        )
      )
      .slice(0, 5)
      .map((item) => {
        const stadium = STADIUMS.find((row) =>
          item.title?.includes(`【${row.name}場攻略】`)
        );
        const image =
          item.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] ||
          FALLBACK_COVER;
        const place = stadium?.name || '攻略';

        return {
          title: cleanArticleTitle(item.title, place) || `${place}場攻略`,
          link: item.link,
          date: item.pubDate,
          image,
          place,
        };
      });
  } catch (error) {
    console.error('stadium RSS error', error);
    return [];
  }
}

export const metadata = {
  title: '全国24場 DATA BOOK｜BoatStrikers',
  description:
    '全国24場の直近1年データ、出目、季節、風、展示AI、今日の出走表と直前評価を場別に確認できます。',
};

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H4V5.5Z" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H14v17a3 3 0 0 1 3-3h3V5.5Z" />
    </svg>
  );
}

function BottomIcon({ type }) {
  const icons = {
    home: <path d="M3 11.5 12 4l9 7.5V21h-6v-6H9v6H3v-9.5Z" />,
    race: <path d="M4 17h16M6 15l3-7 3 4 3-8 3 11M5 20h14" />,
    radio: <><circle cx="12" cy="12" r="2" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.5 4.5a10.6 10.6 0 0 0 0 15M19.5 4.5a10.6 10.6 0 0 1 0 15" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H4V5.5Z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H14v17a3 3 0 0 1 3-3h3V5.5Z" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
  };

  return <svg viewBox="0 0 24 24" aria-hidden="true">{icons[type]}</svg>;
}

export default async function StadiumsPage() {
  const latest = await getLatestStadiumArticles();
  const stadiums = STADIUMS.map((stadium) => ({
    ...stadium,
    href: stadiumPath(stadium),
  }));

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.logo} href="/" aria-label="BoatStrikers ホーム">
          <span>BOAT</span>
          <strong>STRIKERS</strong>
        </a>
        <a
          className={styles.lineButton}
          href="https://lin.ee/Pf3FEEQ"
          target="_blank"
          rel="noopener noreferrer"
        >
          LINE登録
        </a>
      </header>

      <div className={styles.content}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>NATIONAL 24 STADIUMS</p>
            <h1>全国24場攻略 <span>DATA BOOK</span></h1>
            <p className={styles.heroText}>
              年間データと本日の直前情報を場別にチェック
            </p>
            <a className={styles.heroButton} href="#stadium-directory">
              開催場を選ぶ <span aria-hidden="true">›</span>
            </a>
          </div>
          <div className={styles.bookVisual} aria-hidden="true">
            <div className={styles.bookCover}>
              <small>BOAT STRIKERS</small>
              <strong>DATA BOOK</strong>
              <span>24 STADIUMS</span>
              <div className={styles.bookChart}><i /><i /><i /><i /></div>
            </div>
          </div>
        </section>

        {latest.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.headingIcon}><BookIcon /></span>
                <h2>最新攻略記事</h2>
              </div>
              <a href="https://note.com/boat_strikers" target="_blank" rel="noopener noreferrer">
                すべて見る <span>›</span>
              </a>
            </div>

            <div className={styles.articleScroll}>
              {latest.map((article) => (
                <a
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.articleCard}
                  key={article.link}
                >
                  <div className={styles.articleImageWrap}>
                    <img src={article.image} alt="" className={styles.articleImage} />
                    <span>{article.place}</span>
                  </div>
                  <div className={styles.articleBody}>
                    <h3>{article.place}場攻略</h3>
                    <p>{article.title}</p>
                    <div>
                      <time>
                        {article.date
                          ? new Date(article.date).toLocaleDateString('ja-JP', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                            })
                          : ''}
                      </time>
                      <span aria-hidden="true">→</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        <StadiumDirectoryClient stadiums={stadiums} />
      </div>

      <nav className={styles.bottomNav} aria-label="メインメニュー">
        <a href="/"><BottomIcon type="home" /><span>ホーム</span></a>
        <a href="/races"><BottomIcon type="race" /><span>出走表</span></a>
        <a href="/radio"><BottomIcon type="radio" /><span>ラジオ</span></a>
        <a href="/library" className={styles.activeNav} aria-current="page"><BottomIcon type="book" /><span>図書館</span></a>
        <a href="/schedule"><BottomIcon type="calendar" /><span>番組表</span></a>
      </nav>
    </main>
  );
}
