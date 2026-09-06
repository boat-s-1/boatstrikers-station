import Link from 'next/link';
import GenericStadiumPage from '../[place]/page';
import styles from './shimonosekiSeo.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '下関競艇場の特徴・水面・風・コース傾向｜BoatStrikers',
  description: '下関競艇場の特徴を初心者向けに解説。海水面、風や潮位の見方、イン逃げ・コース別傾向、展示で確認したいポイントをBoatStrikersのデータブックとあわせて紹介します。',
  alternates: { canonical: '/library/stadium/shimonoseki' },
  openGraph: {
    title: '下関競艇場の特徴・水面・風・コース傾向｜BoatStrikers',
    description: '下関競艇場の水面・風・潮位・コース傾向を、データと初心者向け解説で確認できます。',
    url: '/library/stadium/shimonoseki',
    type: 'article',
  },
};

function todayJst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default async function ShimonosekiStadiumPage({ searchParams }) {
  const date = todayJst();
  return (
    <>
      <GenericStadiumPage
        params={Promise.resolve({ place: 'shimonoseki' })}
        searchParams={searchParams}
      />

      <section className={styles.seoWrap} aria-labelledby="shimonoseki-guide-title">
        <div className={styles.eyebrow}>SHIMONOSEKI BOAT RACE GUIDE</div>
        <h2 id="shimonoseki-guide-title">下関競艇場の特徴・水面・風・コース傾向</h2>
        <p className={styles.lead}>
          下関競艇場を初めて見る方に向けて、水面・風・潮位・進入・コース別の見方を整理します。
          上のDATA BOOKで数値を確認し、この解説で「どこを見るか」をつかむ使い方がおすすめです。
        </p>

        <nav className={styles.toc} aria-label="下関競艇場攻略の目次">
          <strong>このページで分かること</strong>
          <a href="#shimonoseki-water">水面の特徴</a>
          <a href="#shimonoseki-inside">イン・1コースの見方</a>
          <a href="#shimonoseki-course">2〜6コースの見方</a>
          <a href="#shimonoseki-check">直前に確認したいポイント</a>
        </nav>

        <div className={styles.grid}>
          <article id="shimonoseki-water" className={styles.card}>
            <span>01 / WATER</span>
            <h3>下関の水面は「風・潮位」をセットで見る</h3>
            <p>
              下関は海水を利用する水面です。海水面では潮位の変化があり、同じ場でも時間帯によって見え方が変わることがあります。
              ただし「潮が高いから必ず外有利」のように単独条件で決めず、当日の風向・風速、波、展示気配と合わせて確認します。
            </p>
            <p>
              ナイター開催では昼から夜へ気象条件が変わることもあるため、過去の場傾向だけでなく直前情報を優先するのが基本です。
            </p>
          </article>

          <article id="shimonoseki-inside" className={styles.card}>
            <span>02 / INSIDE</span>
            <h3>1コースは「進入・ST・展示気配」まで確認</h3>
            <p>
              1号艇を見るときは、艇番だけでなく実際の進入コース、スタート展示、モーターと展示の気配を確認します。
              上のDATA BOOKにある1コース1着率やイン逃げ率は、場の大きな傾向をつかむための入口です。
            </p>
            <p>
              前付けなどで進入が深くなる場合や、外側にスタートの早い艇がいる場合は、普段と同じイン評価で決めつけないことが大切です。
            </p>
          </article>

          <article id="shimonoseki-course" className={styles.card}>
            <span>03 / COURSE</span>
            <h3>2〜6コースは「誰が攻めるか」から展開を見る</h3>
            <p>
              2コースは差し、3・4コースはまくりやまくり差し、5・6コースは内側の攻めに乗る展開などを基本形として考えます。
              ただし実際の狙いは選手・スタート・モーター・展示によって変わります。
            </p>
            <p>
              特に4コース付近から攻める気配があるときは、その艇だけでなく5コースまで展開が向く可能性を見るのがBoatStrikersの考え方です。
            </p>
          </article>

          <article id="shimonoseki-check" className={styles.card}>
            <span>04 / CHECK</span>
            <h3>下関で直前に確認したい4項目</h3>
            <ul>
              <li>スタート展示の進入と展示ST</li>
              <li>風向・風速と水面コンディション</li>
              <li>展示タイムだけでなく直線・ターンの気配</li>
              <li>1号艇と攻め艇のスタート力の比較</li>
            </ul>
            <p>条件が読みづらいレースは無理に絞らず、見送ることも選択肢です。</p>
          </article>
        </div>

        <aside className={styles.bsPoint}>
          <strong>BoatStrikersの見方</strong>
          <p>
            場の特徴は「固定ルール」ではなく土台として使います。DATA BOOKの場別データに、当日の出走表・展示・風・進入を重ねて判断します。
            まず場の傾向を知り、その日の条件で上書きするイメージです。
          </p>
        </aside>

        <div className={styles.actions}>
          <Link href={`/races/19/info?date=${date}`} className={styles.primary}>今日の下関の出走表を見る</Link>
          <Link href="/guide/exhibition-time">展示タイムの見方を読む</Link>
          <Link href="/guide/course-entry">進入・前付けを学ぶ</Link>
          <Link href="/library/stadiums">24場攻略一覧へ戻る</Link>
        </div>

        <footer className={styles.note}>
          <p>掲載内容は過去データや一般的な水面・レースの見方を整理したもので、将来の結果や的中を保証するものではありません。最新の気象・展示・公式情報もあわせてご確認ください。</p>
        </footer>
      </section>
    </>
  );
}
