import Link from 'next/link';
import { resolveStadium } from '../../../../lib/stadiums';
import styles from './stadiumSeoGuide.module.css';

function todayJst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const focusByCourse = {
  1: ['インの信頼度', '風による変化', '展示気配'],
  2: ['コース別1着率', 'イン不成立時の展開', 'スタート比較'],
  3: ['水面コンディション', '進入', '展示とスタート'],
  4: ['1コースの信頼度', 'センター勢の攻め', '展示気配'],
  5: ['イン逃げ率', 'コース別傾向', '直前展示'],
  6: ['風と水面', 'モーター気配', 'コース別1着率'],
  7: ['インの信頼度', '展示重要度', 'ナイターの直前情報'],
  8: ['コース別傾向', 'スタート', '展示気配'],
  9: ['風の影響', 'イン逃げ率', '進入'],
  10: ['水面と風', '1コース1着率', '展示'],
  11: ['水面コンディション', 'イン信頼度', 'コース別傾向'],
  12: ['イン逃げ率', 'センターの攻め', '展示気配'],
  13: ['コース別1着率', 'スタート比較', '直前情報'],
  14: ['風と水面', 'インの信頼度', '展示'],
  15: ['イン逃げ率', 'コース別傾向', 'ナイターの直前情報'],
  16: ['水面コンディション', '進入', 'スタート展示'],
  17: ['潮位・水面', 'インの信頼度', '展示気配'],
  18: ['1コース1着率', '風', 'コース別傾向'],
  20: ['ナイターの直前情報', 'イン逃げ率', '展示気配'],
  21: ['インの信頼度', 'スタート比較', '展示'],
  22: ['水面コンディション', 'コース別傾向', '進入'],
  23: ['風と水面', '1コース1着率', '展示気配'],
  24: ['イン逃げ率', 'コース別1着率', 'スタート展示'],
};

export default function StadiumSeoGuide({ place }) {
  const stadium = resolveStadium(place);
  if (!stadium || stadium.slug === 'shimonoseki') return null;

  const date = todayJst();
  const focuses = focusByCourse[stadium.courseCode] || ['インの信頼度', 'コース別傾向', '展示気配'];
  const prefix = stadium.slug;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${stadium.name}競艇場の特徴・水面・風・コース傾向`,
    description: `${stadium.name}競艇場の特徴を、場別データと直前情報の見方から初心者向けに解説します。`,
    mainEntityOfPage: `https://www.boat-strike.online/library/stadium/${stadium.slug}`,
    author: { '@type': 'Organization', name: 'BoatStrikers' },
    publisher: { '@type': 'Organization', name: 'BoatStrikers' },
  };

  return (
    <section className={styles.seoWrap} aria-labelledby={`${prefix}-guide-title`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className={styles.eyebrow}>{stadium.englishName} GUIDE</div>
      <h2 id={`${prefix}-guide-title`}>{stadium.name}競艇場の特徴・水面・風・コース傾向</h2>
      <p className={styles.lead}>
        {stadium.name}競艇場を予想するときに確認したいポイントを、上のDATA BOOKとあわせて整理します。
        場の固定イメージだけで決めず、当日の進入・スタート・展示・風などで上書きして見るのがBoatStrikersの基本です。
      </p>

      <nav className={styles.toc} aria-label={`${stadium.name}競艇場攻略の目次`}>
        <strong>このページで分かること</strong>
        <a href={`#${prefix}-data`}>場別データの見方</a>
        <a href={`#${prefix}-inside`}>イン・1コースの見方</a>
        <a href={`#${prefix}-course`}>2〜6コースの見方</a>
        <a href={`#${prefix}-check`}>直前に確認するポイント</a>
      </nav>

      <div className={styles.focusRow}>
        {focuses.map((item, index) => <span key={item}><b>{index + 1}</b>{item}</span>)}
      </div>

      <div className={styles.grid}>
        <article id={`${prefix}-data`} className={styles.card}>
          <span>01 / DATA</span>
          <h3>{stadium.name}は「場別データ」と当日の条件を分けて見る</h3>
          <p>
            まずDATA BOOKの1コース1着率、イン逃げ率、コース別1着率などから、{stadium.name}の大きな傾向を確認します。
            過去データは予想の土台として使い、当日の気象・進入・展示と矛盾していないかを確認します。
          </p>
          <p>サンプル数や集計期間も確認し、数字が高い・低いという理由だけで買い目を決めないことが重要です。</p>
        </article>

        <article id={`${prefix}-inside`} className={styles.card}>
          <span>02 / INSIDE</span>
          <h3>1号艇は「艇番」ではなく実進入とスタートまで確認</h3>
          <p>
            1号艇を評価するときは、実際に1コースへ入れるか、進入が深くならないか、スタート展示で遅れていないかを確認します。
            DATA BOOKのイン信頼度は入口として使い、選手・モーター・展示気配を重ねて判断します。
          </p>
          <p>前付けや進入変化があるレースでは、通常時の場傾向よりも直前の並びを優先します。</p>
        </article>

        <article id={`${prefix}-course`} className={styles.card}>
          <span>03 / COURSE</span>
          <h3>2〜6コースは「最初に攻める艇」を探す</h3>
          <p>
            2コースの差し、3・4コースのまくり・まくり差し、5・6コースの展開突きという基本形を押さえつつ、
            {stadium.name}のコース別1着率と当日のスタート気配を比較します。
          </p>
          <p>センターに攻める艇がいるときは、その艇だけでなく外側の艇まで展開が向く可能性を確認します。</p>
        </article>

        <article id={`${prefix}-check`} className={styles.card}>
          <span>04 / CHECK</span>
          <h3>{stadium.name}で直前に確認したい4項目</h3>
          <ul>
            <li>スタート展示の進入と展示ST</li>
            <li>風向・風速と水面コンディション</li>
            <li>展示タイム・直線・ターンの気配</li>
            <li>1号艇と攻め艇のスタート力の比較</li>
          </ul>
          <p>場の傾向と直前情報が大きく食い違う場合は、見送ることも含めて判断します。</p>
        </article>
      </div>

      <aside className={styles.bsPoint}>
        <strong>BoatStrikersの見方</strong>
        <p>
          {stadium.name}の攻略情報は「この場なら必ずこうなる」という固定ルールではありません。
          場別データ → 出走表 → 進入 → 展示 → 風の順に情報を重ね、当日の条件を優先して使います。
        </p>
      </aside>

      <div className={styles.actions}>
        <Link href={`/races/${String(stadium.courseCode).padStart(2, '0')}/info?date=${date}`} className={styles.primary}>今日の{stadium.name}の出走表を見る</Link>
        <Link href="/guide/exhibition-time">展示タイムの見方を読む</Link>
        <Link href="/guide/course-entry">進入・前付けを学ぶ</Link>
        <Link href="/library/stadiums">24場攻略一覧へ戻る</Link>
      </div>

      <footer className={styles.note}>
        過去データや一般的なレースの見方を整理した情報です。将来の結果や的中を保証するものではありません。最新の気象・展示・公式情報もあわせてご確認ください。
      </footer>
    </section>
  );
}
