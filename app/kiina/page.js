import Image from "next/image";

const pickups = [
  { place: "桐生", race: "10R", tag: "穴狙い本線", score: "85%" },
  { place: "津", race: "11R", tag: "波乱警戒", score: "78%" },
  { place: "若松", race: "12R", tag: "高配当期待", score: "72%" },
];

const results = [
  { amount: "243,800円", race: "住之江 12R", date: "5/18 的中" },
  { amount: "178,650円", race: "桐生 10R", date: "5/12 的中" },
  { amount: "152,300円", race: "びわこ 11R", date: "5/3 的中" },
];

const labs = [
  {
    title: "5号艇が頭になる条件チェックリスト",
    date: "2026.06.20",
    image: "/kiina-lab1.jpg",
  },
  {
    title: "波乱を生む3つのパターン",
    date: "2026.06.18",
    image: "/kiina-lab2.jpg",
  },
  {
    title: "狙い目モーターの見抜き方",
    date: "2026.06.16",
    image: "/kiina-lab3.jpg",
  },
];

export default function KiinaPage() {
  return (
    <main className="page kiinaPage">
      <header className="header">
        <div className="logo">BOAT<br /><span>STRIKERS</span></div>
        <a className="lineMini" href="https://lin.ee/Pf3FEEQ">LINE登録</a>
      </header>

      <section className="hero">
        <Image
          src="/kiina-hero.png"
          alt="キイナの部屋"
          width={1536}
          height={864}
          priority
          className="heroImage"
        />
      </section>

      <section className="sectionCard yellowCard">
        <h2>⚡ 今日の5アタマ新聞（前日版）</h2>
        <div className="newsFeature">
          <Image
            src="/kiina-news.jpg"
            alt="キイナ新聞"
            width={600}
            height={600}
            className="featureImg"
          />
          <div>
            <h3>6月27日 前日版</h3>
            <p>高配当が狙える5アタマ注目レースを公開！</p>
            <a href="#" className="yellowBtn">📖 新聞を読む</a>
            <a href="#" className="outlineBtn yellowOutline">一覧を見る</a>
          </div>
        </div>
      </section>

      <section className="sectionCard yellowCard">
        <h2>🚤 今日の5アタマピックアップ</h2>
        {pickups.map((r) => (
          <div className="raceRow kiinaRace" key={`${r.place}${r.race}`}>
            <strong>{r.place} {r.race}</strong>
            <span>{r.tag}</span>
            <b>期待度 {r.score}</b>
          </div>
        ))}
        <button className="moreBtn yellowBtn">もっと見る</button>
      </section>

      <section className="sectionCard yellowCard">
        <h2>🏆 高配当実績（直近3ヶ月）</h2>
        <div className="resultGrid">
          {results.map((r) => (
            <div className="resultMini" key={r.amount}>
              <div className="trophy">🏆</div>
              <strong>{r.amount}</strong>
              <p>{r.race}</p>
              <small>{r.date}</small>
            </div>
          ))}
        </div>
        <button className="moreBtn yellowBtn">高配当実績をもっと見る</button>
      </section>

      <section className="sectionCard yellowCard">
        <div className="sectionTitleRow">
          <h2>🔬 穴党ラボ</h2>
          <a className="yellowText" href="#">もっと見る ›</a>
        </div>

        <div className="labList">
          {labs.map((lab) => (
            <div className="labItem yellowLab" key={lab.title}>
              <Image
                src={lab.image}
                alt={lab.title}
                width={180}
                height={120}
              />
              <div>
                <h3>{lab.title}</h3>
                <small>{lab.date}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="sectionCard yellowCard">
        <h2>🧪 5アタマ予想ツールβ版</h2>
        <div className="toolBox">
          <p>5頭ボックスで高配当を狙え！</p>
          <div className="boatNums">
            <span>1</span><span>2</span><span>3</span>
            <span>4</span><span className="active">5</span><span>6</span>
          </div>
          <button className="yellowBtn">予想する</button>
        </div>
      </section>

      <section className="sectionCard yellowCard">
        <h2>📚 過去のバックナンバー</h2>
        <div className="monthGrid">
          <a href="#">2026年6月<br /><span className="yellowNew">NEW</span></a>
          <a href="#">2026年5月</a>
          <a href="#">2026年4月</a>
          <a href="#">2026年3月</a>
          <a href="#">2026年2月</a>
          <a href="#">2026年1月</a>
        </div>
      </section>

      <section className="lineBox">
        <h2>LINE登録で<br />限定情報をGET！</h2>
        <p>前日版・直前版・5アタマ予想・高配当実績を無料でお届けします。</p>
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
