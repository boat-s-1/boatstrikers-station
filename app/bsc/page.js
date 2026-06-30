import BscStatus from "./BscStatus";
import BscLessonList from "./BscLessonList";

const lessons = [
  { id: 1, title: "競艇ってどんな競技？", badge: "競艇入門" },
  { id: 2, title: "6艇で走るってどういうこと？", badge: "6艇理解" },
  { id: 3, title: "コースと枠番を学ぼう", badge: "コース理解" },
  { id: 4, title: "1号艇とイン逃げとは？", badge: "イン逃げ初級" },
  { id: 5, title: "スタート展示ってなに？", badge: "展示入門" },
];

export default function BscPage() {
  return (
    <main className="libraryPage">
      <header className="header">
        <div className="logo">
          BOAT<br />
          <span>STRIKERS</span>
        </div>
        <a className="lineMini" href="https://lin.ee/Pf3FEEQ">
          LINE登録
        </a>
      </header>

      <section className="bscHero">
        <span>🎮 BSC</span>
        <h1>BOAT STRIKERS CHALLENGE</h1>
        <p>競艇の基礎をゲーム感覚で学ぼう！</p>
        <b>Chapter1：競艇入門編</b>
      </section>

      <BscStatus />

      <section className="librarySection">
        <h2>📘 レッスン一覧</h2>
        <BscLessonList lessons={lessons} />
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
