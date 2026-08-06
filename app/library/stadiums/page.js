import Parser from 'rss-parser';
import { STADIUMS, stadiumPath } from '../../../lib/stadiums';

async function getLatestStadiumArticles() {
  try {
    const parser = new Parser();
    const feed = await parser.parseURL('https://note.com/boat_strikers/rss');
    return feed.items
      .filter(item => STADIUMS.some(stadium => item.title?.includes(`【${stadium.name}場攻略】`)))
      .slice(0, 5)
      .map(item => {
        const image = item.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] || '/book-24-stadiums.jpg';
        const stadium = STADIUMS.find(row => item.title?.includes(`【${row.name}場攻略】`));
        return { title: item.title, link: item.link, date: item.pubDate, image, place: stadium?.name || '攻略' };
      });
  } catch (error) {
    console.error('stadium RSS error', error);
    return [];
  }
}

export const metadata = {
  title: '全国24場 DATA BOOK｜BoatStrikers',
  description: '全国24場の直近1年データ、出目、季節、風、展示AI、今日の出走表と直前評価を場別に確認できます。',
};

export default async function StadiumsPage() {
  const latest = await getLatestStadiumArticles();
  return <main className="libraryPage">
    <header className="header"><div className="logo">BOAT<br/><span>STRIKERS</span></div><a className="lineMini" href="https://lin.ee/Pf3FEEQ">LINE登録</a></header>
    <section className="magazineHero">
      <img src="/book-24-stadiums.jpg" alt="24場攻略DATA BOOK" className="magazineHeroCover" />
      <div className="magazineInfo"><span>DATA BOOK</span><h1>全国24場攻略</h1><p>同じデザイン・同じ集計定義で、24場すべてを比較できます。</p></div>
    </section>

    {latest.length > 0 && <section className="librarySection"><h2>🆕 最新攻略記事</h2><div className="stadiumLatestScroll">
      {latest.map(article => <a href={article.link} target="_blank" rel="noopener noreferrer" className="stadiumLatestCard" key={article.link}><img src={article.image} alt={article.title}/><span>{article.place}</span><h3>{article.title}</h3><p>{article.date ? new Date(article.date).toLocaleDateString('ja-JP') : ''}</p></a>)}
    </div></section>}

    <section className="libraryShelfSection"><h2>📚 全国24場 DATA BOOK</h2><p>場を選ぶと、年間データと今日の直前攻略を確認できます。</p><div className="stadiumSpineShelf">
      {STADIUMS.map(stadium => <a href={stadiumPath(stadium)} className="stadiumSpineBook" key={stadium.slug}><span>{String(stadium.courseCode).padStart(2,'0')}</span><strong>{stadium.name}</strong></a>)}
    </div><div className="shelfBoard"/></section>
    <nav className="bottomNav"><a href="/">ホーム</a><a href="/races">出走表</a><a href="/radio">ラジオ</a><a href="/library">図書館</a><a href="/schedule">番組表</a></nav>
  </main>;
}
