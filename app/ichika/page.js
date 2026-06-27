import Image from "next/image";
import Parser from "rss-parser";

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

        <div className="newsFeature">
          <Image
            src="/today-news.jpg"
            alt="一果新聞"
            width={600}
            height={600}
            className="featureImg"
          />

          <div>
            <h3>6月27日 前日版</h3>
            <p>一果が選んだイン逃げ注目レースを掲載！</p>

            <a href="#" className="pinkBtn">
              📖 新聞を読む
            </a>
          </div>
        </div>
      </section>

      <section className="sectionCard pinkCard">
        <h2>🚤 一果のおすすめレース</h2>

        <div className="raceItem">
          <strong>丸亀 1R</strong>
          <span>イン逃げ期待度 84%</span>
        </div>

        <div className="raceItem">
          <strong>戸田 2R</strong>
          <span>イン逃げ期待度 78%</span>
        </div>

        <div className="raceItem">
          <strong>若松 3R</strong>
          <span>イン逃げ期待度 72%</span>
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
        src={
          article.image ||
          "/ichika-banner.jpg"
        }
        alt={article.title}
      />

      <div>
        <h3>{article.title}</h3>

        <small>
          {new Date(article.date)
            .toLocaleDateString("ja-JP")}
        </small>
      </div>
    </a>
  ))}
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
