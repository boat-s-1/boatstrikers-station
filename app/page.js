import Image from "next/image";
import "./style.css";

const characters = [
  {
    name: "一果",
    role: "イン逃げ担当",
    color: "pink",
    image: "/ichika.png",
    text: "イン逃げは私におまかせ！",
    items: ["イン逃げ予想", "前日版新聞", "イン逃げ研究所"],
  },
  {
    name: "初音",
    role: "女子戦担当",
    color: "purple",
    image: "/hatsune.png",
    text: "女子戦のことなら任せてください！",
    items: ["女子戦新聞", "女子戦データ分析", "おすすめレース"],
  },
  {
    name: "キイナ",
    role: "5アタマ担当",
    color: "yellow",
    image: "/kiina.png",
    text: "5アタマで高配当狙います！",
    items: ["5アタマ予想", "穴党ラボ", "高配当実績"],
  },
];

const news = [
  { title: "一果新聞 前日版", race: "6/26 丸亀1R", img: "/news-ichika.png" },
  { title: "初音新聞 女子戦前日版", race: "6/26 戸田2R", img: "/news-hatsune.png" },
  { title: "キイナ新聞 5アタマ前日版", race: "6/26 若松4R", img: "/news-kiina.png" },
];

export default function Home() {
  return (
    <main className="page">
      <header className="header">
        <Image src="/logo.png" alt="BoatStrikers" width={190} height={80} />
        <button className="menuBtn">メニュー</button>
      </header>

      <section className="hero">
        <Image
          src="/hero-characters.png"
          alt="一果・初音・キイナ"
          width={900}
          height={900}
          className="heroImg"
          priority
        />
        <h1>3人の力で<br />一緒に勝ちにいこう！</h1>
        <p>一果・初音・キイナのボートレース放送局</p>
      </section>

      <section className="section">
        <h2>CHARACTER</h2>
        <p className="lead">個性あふれる3人のボートレーサー予想チーム！</p>

        {characters.map((c) => (
          <div className={`charCard ${c.color}`} key={c.name}>
            <div>
              <h3>✦ {c.name} ✦</h3>
              <strong>{c.role}</strong>
              <p>{c.text}</p>
              <ul>
                {c.items.map((item) => (
                  <li key={item}>✓ {item}</li>
                ))}
              </ul>
              <button>{c.name}の部屋へ</button>
            </div>
            <Image src={c.image} alt={c.name} width={220} height={260} />
          </div>
        ))}
      </section>

      <section className="section news">
        <h2>TODAY'S NEWS</h2>
        {news.map((n) => (
          <div className="newsItem" key={n.title}>
            <Image src={n.img} alt={n.title} width={90} height={90} />
            <div>
              <strong>{n.title}</strong>
              <p>{n.race}</p>
            </div>
            <button>読む</button>
          </div>
        ))}
      </section>

      <section className="resultCard">
        <h2>🏆 的中実績</h2>
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
        <button>的中実績をもっと見る</button>
      </section>

      <section className="radioCard">
        <h2>🎙 BoatStrikers Radio</h2>
        <Image src="/radio.png" alt="ラジオ" width={500} height={260} />
        <p>最新ラジオ「イン逃げ事件簿！今週の反省会」</p>
        <button>ラジオを聴く</button>
      </section>

      <section className="libraryCard">
        <h2>📚 一果図書館</h2>
        <Image src="/library.png" alt="一果図書館" width={500} height={260} />
        <p>過去の新聞・結果・反省コメントをチェック！</p>
        <button>図書館へ行く</button>
      </section>

      <section className="lineBox">
        <h2>LINE登録で<br />限定特典をGET！</h2>
        <button>LINEで受け取る</button>
      </section>

      <nav className="bottomNav">
        <a>ホーム</a>
        <a>一果</a>
        <a>初音</a>
        <a>キイナ</a>
        <a>メニュー</a>
      </nav>
    </main>
  );
}
