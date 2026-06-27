import Image from "next/image";

const news = [
  { title: "一果新聞 前日版", race: "6/26 丸亀1R", tag: "イン逃げ" },
  { title: "初音新聞 女子戦版", race: "6/26 戸田2R", tag: "女子戦" },
  { title: "キイナ新聞 5アタマ版", race: "6/26 若松4R", tag: "穴狙い" },
];

export default function Home() {
  return (
    <main className="page">
      <header className="header">
        <div className="logo">BOAT<br /><span>STRIKERS</span></div>
        <a className="lineMini" href="https://lin.ee/Pf3FEEQ">LINE登録</a>
      </header>

      <section className="hero">
        <Image
          src="/hero.jpg"
          alt="BoatStrikers"
          width={1536}
          height={864}
          priority
          className="heroImage"
        />
        <div className="heroText">
          <p>一果・初音・キイナの競艇放送局</p>
          <h1>3人の力で<br />一緒に勝ちにいこう！</h1>
          <a href="https://lin.ee/Pf3FEEQ" className="mainBtn">
            LINEで最新情報を受け取る
          </a>
        </div>
      </section>

      <section className="section">
        <a href="/radio" className="bannerLink">
          <Image
            src="/radio-banner.jpg"
            alt="BoatStrikers Radio"
            width={1536}
            height={864}
            className="bannerImage"
          />
        </a>
      </section>

      <section className="section">
        <a href="/ichika" className="bannerLink">
          <Image
            src="/ichika-banner.jpg"
            alt="一果の部屋"
            width={1536}
            height={1080}
            className="bannerImage"
          />
        </a>

        <a href="/hatsune" className="bannerLink">
          <Image
            src="/hatsune-banner.jpg"
            alt="初音の部屋"
            width={1536}
            height={1080}
            className="bannerImage"
          />
        </a>

        <a href="/kiina" className="bannerLink">
          <Image
            src="/kiina-banner.jpg"
            alt="キイナの部屋"
            width={1536}
            height={1080}
            className="bannerImage"
          />
        </a>
      </section>

      <section className="section">
        <h2>今日の新聞</h2>
        {news.map((n) => (
          <div className="newsItem" key={n.title}>
            <div>
              <strong>{n.title}</strong>
              <p>{n.race}</p>
            </div>
            <span>{n.tag}</span>
            <button>読む</button>
          </div>
        ))}
      </section>

      <section className="section">
        <a href="/library" className="bannerLink">
          <Image
            src="/library-banner.jpg"
            alt="一果図書館"
            width={1536}
            height={864}
            className="bannerImage"
          />
        </a>
      </section>

      <section className="resultBox">
        <h2>🏆 的中実績</h2>
        <p>今月も絶好調！</p>
        <div className="stats">
          <div>
            <span>的中率</span>
            <strong>72.4%</strong>
          </div>
          <div>
            <span>回収率</span>
            <strong>118.6%</strong>
          </div>
        </div>
        <button>的中実績を見る</button>
      </section>

      <section className="lineBox">
        <h2>LINE登録で<br />限定新聞をGET！</h2>
        <p>前日版・直前版・ラジオ情報を無料でお届けします。</p>
        <a href="https://lin.ee/Pf3FEEQ">LINEで受け取る</a>
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
