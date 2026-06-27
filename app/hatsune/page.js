import Image from "next/image";

const pickups = [
  { place: "戸田", race: "2R", tag: "イン逃げ本線", score: "85%" },
  { place: "尼崎", race: "3R", tag: "差し注目", score: "78%" },
  { place: "多摩川", race: "6R", tag: "まくり注目", score: "72%" },
];

const labs = [
  {
    title: "女子戦の狙い方7選",
    text: "女子戦で勝つためのポイントを解説！",
    date: "2026.06.20",
    image: "/hatsune-lab1.jpg",
  },
  {
    title: "女子選手の特徴まとめ",
    text: "特徴を知れば予想精度がUP！",
    date: "2026.06.18",
    image: "/hatsune-lab2.jpg",
  },
  {
    title: "気配の見極め方",
    text: "展示・直前情報の見方を伝授！",
    date: "2026.06.16",
    image: "/hatsune-lab3.jpg",
  },
];

export default function HatsunePage() {
  return (
    <main className="page hatsunePage">
      <header className="header">
        <div className="logo">BOAT<br /><span>STRIKERS</span></div>
        <a className="lineMini" href="https://lin.ee/Pf3FEEQ">LINE登録</a>
      </header>

      <section className="hero">
        <Image
          src="/hatsune-hero.jpg"
          alt="初音の部屋"
          width={1536}
          height={864}
          priority
          className="heroImage"
        />
      </section>

      <section className="sectionCard purpleCard">
        <h2>💜 今日の女子戦新聞（前日版）</h2>
        <div className="newsFeature">
          <Image
            src="/hatsune-news.jpg"
            alt="初音新聞"
            width={600}
            height={600}
            className="featureImg"
          />
          <div>
            <h3>6月27日 前日版</h3>
            <p>データから見えた女子戦の狙い目を公開！</p>
            <a href="#" className="purpleBtn">📖 新聞を読む</a>
            <a href="#" className="outlineBtn purpleOutline">一覧を見る</a>
          </div>
        </div>
      </section>

      <section className="sectionCard purpleCard">
        <h2>🚤 今日の女子戦ピックアップ</h2>
        {pickups.map((r) => (
          <div className="raceRow" key={`${r.place}${r.race}`}>
            <strong>{r.place} {r.race}</strong>
            <span>{r.tag}</span>
            <b>注目度 {r.score}</b>
          </div>
        ))}
        <button className="moreBtn purpleBtn">もっと見る</button>
      </section>

      <section className="sectionCard purpleCard">
        <div className="sectionTitleRow">
          <h2>📊 女子戦データ分析</h2>
          <a href="#">もっと見る ›</a>
        </div>

        <div className="dataGrid">
          <div className="dataBox">
            <h3>コース別勝率</h3>
            <strong>1コース 55%</strong>
            <p>女子戦の1コースはやっぱり強い！</p>
          </div>
          <div className="dataBox">
            <h3>モーター勝率</h3>
            <strong>29号機 6.45</strong>
            <p>好調モーターを要チェック！</p>
          </div>
          <div className="dataBox">
            <h3>ST分析</h3>
            <strong>0.10〜0.15</strong>
            <p>早いSTが勝負を分ける！</p>
          </div>
        </div>
      </section>

      <section className="sectionCard purpleCard">
        <div className="sectionTitleRow">
          <h2>🔬 女子戦研究ラボ</h2>
          <a href="#">もっと見る ›</a>
        </div>

        <div className="labList">
          {labs.map((lab) => (
            <div className="labItem" key={lab.title}>
              <Image
                src={lab.image}
                alt={lab.title}
                width={180}
                height={120}
              />
              <div>
                <h3>{lab.title}</h3>
                <p>{lab.text}</p>
                <small>{lab.date}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="sectionCard purpleCard">
        <h2>📚 過去のバックナンバー</h2>
        <div className="monthGrid">
          <a href="#">2026年6月<br /><span>NEW</span></a>
          <a href="#">2026年5月</a>
          <a href="#">2026年4月</a>
          <a href="#">2026年3月</a>
          <a href="#">2026年2月</a>
          <a href="#">2026年1月</a>
        </div>
      </section>

      <section className="lineBox">
        <h2>LINE登録で<br />限定情報をGET！</h2>
        <p>前日版・直前版・女子戦データ・ラジオ情報を無料でお届けします。</p>
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
