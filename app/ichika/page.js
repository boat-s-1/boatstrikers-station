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

const articles = [
{
title: “インが飛ぶ条件7選”,
date: “2026.06.20”,
image: “/lab1.jpg”,
},
{
title: “モーター相場の見方”,
date: “2026.06.18”,
image: “/lab2.jpg”,
},
{
title: “展示タイム活用法”,
date: “2026.06.16”,
image: “/lab3.jpg”,
},
];

export default function IchikaPage() {
return (
  {/* ヘッダー */}
  <header className="pageHeader">
    <a href="/">← トップへ戻る</a>
  </header>
  {/* ヒーロー */}
  <section className="heroSection">
    <Image
      src="/ichika-hero.png"
      alt="一果"
      width={1536}
      height={2048}
      className="heroImage"
    />
  </section>
  {/* 今日の新聞 */}
  <section className="sectionCard">
    <h2>📰 今日の一果新聞（前日版）</h2>
    <div className="newspaperBox">
      <Image
        src="/today-news.jpg"
        alt="一果新聞"
        width={500}
        height={700}
        className="newspaperImage"
      />
      <div>
        <h3>6月27日 前日版</h3>
        <p>
          一果が選んだイン逃げ注目レースを掲載！
        </p>
        <a href="#" className="pinkBtn">
          📖 新聞を読む
        </a>
      </div>
    </div>
  </section>
  {/* おすすめレース */}
  <section className="sectionCard">
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
  {/* イン飛び研究ラボ */}
  <section className="sectionCard">
    <h2>🔬 イン飛び研究ラボ</h2>
    <div className="articleGrid">
      {articles.map((a) => (
        <div className="articleCard" key={a.title}>
          <Image
            src={a.image}
            alt={a.title}
            width={400}
            height={250}
          />
          <h3>{a.title}</h3>
          <p>{a.date}</p>
        </div>
      ))}
    </div>
  </section>
  {/* バックナンバー */}
  <section className="sectionCard">
    <h2>📚 過去のバックナンバー</h2>
    <div className="monthGrid">
      <a href="#">2026年6月</a>
      <a href="#">2026年5月</a>
      <a href="#">2026年4月</a>
      <a href="#">2026年3月</a>
    </div>
  </section>
  {/* LINE */}
  <section className="lineArea">
    <h2>LINE登録で限定新聞GET！</h2>
    <p>
      前日版・直前版・ラジオ情報を無料配信中
    </p>
    <a
      href="https://lin.ee/Pf3FEEQ"
      className="lineBtn"
    >
      LINE登録はこちら
    </a>
  </section>
</main>

);
}
