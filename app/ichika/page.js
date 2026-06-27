import Image from "next/image";
import Parser from "rss-parser";



async function getIchikaNewspaper() {
  const parser = new Parser();

  const feed = await parser.parseURL("https://note.com/boat_strikers/rss");

  const item = feed.items.find((item) =>
    item.title.includes("【一果前日版】")
  );

  if (!item) return null;

  const image =
    item.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] || "/ichika-banner.jpg";

  return {
    title: item.title,
    link: item.link,
    date: item.pubDate,
    image,
  };
}

const articles = await getIchikaArticles();
const newspaper = await getIchikaNewspaper();

async function getIchikaArticles() {
  const parser = new Parser();

  const feed = await parser.parseURL("https://note.com/boat_strikers/rss");

  return feed.items
    .filter((item) => item.title.includes("【一果ゼミ"))
    .slice(0, 6)
    .map((item) => {
      const image =
        item.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] || "";

      return {
        title: item.title,
        link: item.link,
        date: item.pubDate,
        image,
      };
    });
}

export default async function IchikaPage() {
  const articles = await getIchikaArticles();

  return (
    <main className="page ichikaPage">
      <header className="header">
        <div className="logo">
          BOAT
          <br />
          <span>STRIKERS</span>
        </div>
        <a className="lineMini" href="https://lin.ee/Pf3FEEQ">
          LINE登録
        </a>
      </header>

      <section className="hero">
        <Image
          src="/7562660D-EB9C-4981-A1D1-789E6211DACA.png"
          alt="一果"
          width={1536}
          height={2048}
          className="heroImage"
          priority
        />
      </section>


            
     <section className="sectionCard pinkCard">
  <h2>📰 今日の一果新聞（前日版）</h2>

  {newspaper ? (
    <a
      href={newspaper.link}
      target="_blank"
      rel="noopener noreferrer"
      className="newsFeature"
    >
      <img
        src={newspaper.image}
        alt={newspaper.title}
        className="featureImg"
      />

      <div>
        <h3>{newspaper.title}</h3>
        <p>{new Date(newspaper.date).toLocaleDateString("ja-JP")}</p>
        <span className="pinkBtn">📖 新聞を読む</span>
      </div>
    </a>
  ) : (
    <p>今日の一果新聞はまだありません。</p>
  )}
</section>

<section className="sectionCard">
    <h2>一果のイン逃げツール（β版）</h2>
  <a
    href="https://www.boat-strike.com/ichika"
    target="_blank"
    rel="noopener noreferrer"
  >
    <Image
      src="/F7854611-D2F7-4CF6-B549-FDB9F581F530.png"
      alt="一果鬼絞り判定所"
      width={1536}
      height={864}
      style={{
        width: "100%",
        height: "auto",
        borderRadius: "20px",
      }}
    />
  </a>
</section>
    
    <section className="sectionCard pinkCard">
  <h2>🏆 今月の成績</h2>
  <p className="recordLead">データが証明する、一果のイン逃げ力！</p>

  <div className="recordGrid">
    <div className="recordCard">
      <span>予想レース数</span>
      <strong>42R</strong>
      <p>今月の予想数</p>
    </div>

    <div className="recordCard">
      <span>的中率</span>
      <strong>71%</strong>
      <p>的中レース数 30R</p>
    </div>

    <div className="recordCard">
      <span>回収率</span>
      <strong>126%</strong>
      <p>収支 +42,350円</p>
    </div>

    <div className="recordCard">
      <span>最高配当</span>
      <strong>18,430円</strong>
      <p>6/27 若松4R</p>
    </div>
  </div>

  <div className="hitRaceBox">
    <h3>🎯 今月の主な的中</h3>

    <div className="hitRace">
      <span>6/27 若松4R</span>
      <b>1-2-4</b>
      <strong>18,430円</strong>
    </div>

    <div className="hitRace">
      <span>6/22 丸亀7R</span>
      <b>1-2-3</b>
      <strong>12,760円</strong>
    </div>

    <div className="hitRace">
      <span>6/25 住之江3R</span>
      <b>1-3-2</b>
      <strong>7,840円</strong>
    </div>
  </div>
</section>

 <section className="sectionCard pinkCard">
  <div className="sectionTitleRow">
    <h2>🔬 イン飛び研究ラボ</h2>
    <a
      href="https://note.com/boat_strikers"
      target="_blank"
      rel="noopener noreferrer"
    >
      noteで見る ›
    </a>
  </div>

  <div className="labList">
    {articles.map((article) => (
      <a
        key={article.link}
        href={article.link}
        target="_blank"
        rel="noopener noreferrer"
        className="labItem"
      >
        <img
          src={article.image || "/ichika-banner.jpg"}
          alt={article.title}
        />

        <div>
          <h3>{article.title}</h3>
          <small>
            {new Date(article.date).toLocaleDateString("ja-JP")}
          </small>
        </div>
      </a>
    ))}
  </div>
</section>

      <section className="sectionCard pinkCard">
        <h2>📚 過去のバックナンバー</h2>

        <div className="monthGrid">
          <a href="#">2026年6月</a>
          <a href="#">2026年5月</a>
          <a href="#">2026年4月</a>
          <a href="#">2026年3月</a>
        </div>
      </section>

      <section className="lineBox">
        <h2>
          LINE登録で
          <br />
          限定新聞GET！
        </h2>

        <p>前日版・直前版・ラジオ情報を無料配信中</p>

        <a href="https://lin.ee/Pf3FEEQ">LINE登録はこちら</a>
      </section>

      <nav className="bottomNav">
        <a href="/">ホーム</a>
        <a href="/ichika">一果</a>
        <a href="/hatsune">初音</a>
        <a href="/kiina">キイナ</a>
        <a href="/library">図書館</a>
      </nav>
    </main>
  );
}
