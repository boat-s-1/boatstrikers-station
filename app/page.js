import Image from "next/image";

const characters = [
  {
    name: "一果",
    mark: "🌸",
    role: "イン逃げ担当",
    text: "イン逃げ・イン飛び警報は私におまかせ！",
    color: "pink",
    items: ["イン逃げ予想", "前日版新聞", "イン飛び研究所"],
  },
  {
    name: "初音",
    mark: "💜",
    role: "女子戦担当",
    text: "女子戦の流れと穴目をやさしく解説します！",
    color: "purple",
    items: ["女子戦新聞", "女子戦データ", "おすすめレース"],
  },
  {
    name: "キイナ",
    mark: "⚡",
    role: "5アタマ担当",
    text: "5アタマで高配当を狙う穴党担当です！",
    color: "yellow",
    items: ["5アタマ予想", "穴党ラボ", "高配当実績"],
  },
];

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
          <a href="https://lin.ee/Pf3FEEQ" className="mainBtn">LINEで最新情報を受け取る</a>
        </div>
      </section>

      <section className="section">
        <h2>CHARACTER</h2>
        <p className="lead">個性あふれる3人が、舟券をもっと楽しく！</p>

        {characters.map((c) => (
          <div className={`card ${c.color}`} key={c.name}>
            <div className="cardTop">
              <h3>{c.mark} {c.name}</h3>
              <span>{c.role}</span>
            </div>
            <p>{c.text}</p>
            <ul>
              {c.items.map((item) => (
                <li key={item}>✓ {item}</li>
              ))}
            </ul>
            <button>{c.name}の部屋へ</button>
          </div>
        ))}
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

      <section className="radioBox">
        <h2>🎙 BoatStrikers Radio</h2>
        <p>イン飛び事件簿・女子戦研究・穴党反省会を配信中！</p>
        <button>ラジオを聴く</button>
      </section>

      <section className="libraryBox">
        <h2>📚 一果図書館</h2>
        <p>過去の新聞・直前版・結果・一果コメントをチェック！</p>
        <button>図書館へ行く</button>
      </section>

      <section className="lineBox">
        <h2>LINE登録で<br />限定新聞をGET！</h2>
        <p>前日版・直前版・ラジオ情報を無料でお届けします。</p>
        <a href="https://lin.ee/Pf3FEEQ">LINEで受け取る</a>
      </section>

      <nav className="bottomNav">
        <a>ホーム</a>
        <a>一果</a>
        <a>初音</a>
        <a>キイナ</a>
        <a>図書館</a>
      </nav>
    </main>
  );
}
