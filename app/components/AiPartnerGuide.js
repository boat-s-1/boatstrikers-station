import Image from "next/image";
import { AI_PARTNERS } from "../../lib/aiPartners";
import styles from "./AiPartnerGuide.module.css";

export function AiDiagnosisHeading({ character = "ichika", title, children }) {
  const partner = AI_PARTNERS[character];
  if (!partner) return null;
  return (
    <div className={styles.diagnosisHeading} style={{ "--partner-color": partner.color }}>
      <Image src={partner.image} alt={partner.ai} width={72} height={72} className={styles.miniImage} />
      <div><span className={styles.eyebrow}>AI診断</span><h3>{partner.ai}の{title || `${partner.specialty}診断`}</h3>
        {children || <p>条件に合うレースを検出した診断です。買い目の予想とは分けてご覧ください。</p>}
      </div>
    </div>
  );
}

export function CharacterPredictionHeading({ character = "ichika", children }) {
  const partner = AI_PARTNERS[character];
  if (!partner) return null;
  return (
    <div className={styles.predictionHeading} style={{ "--partner-color": partner.color }}>
      <Image src={partner.portrait} alt={partner.character} width={48} height={48} className={styles.portrait} />
      <div><span className={styles.eyebrow}>キャラ予想</span><h3>{partner.character}の予想</h3>
        {children || <p>{partner.ai}の診断を参考にした買い目です。</p>}
      </div>
    </div>
  );
}

export default function AiPartnerGuide({ character }) {
  const partners = character ? [[character, AI_PARTNERS[character]]] : Object.entries(AI_PARTNERS);
  if (partners.some(([, partner]) => !partner)) return null;
  return (
    <section id={character ? "partner-guide" : "ai-partners"} className={styles.section} aria-label="キャラと相棒AI">
      {!character && <div className={styles.heading}><span className={styles.eyebrow}>CHARACTERS &amp; PARTNER AI</span>
        <h2>相棒AIが診断。3人が予想。</h2><p>AIがデータから注目点を整理し、一果・キイナ・初音がそれぞれの視点で買い目を考えます。</p>
      </div>}
      <div className={`${styles.grid} ${character ? styles.single : ""}`}>
        {partners.map(([key, partner]) => <article key={key} className={styles.card} style={{ "--partner-color": partner.color }}>
          <div className={styles.cardTop}><div><span className={styles.eyebrow}>{partner.specialty}担当</span>
            <h2>{partner.character}<small>＆</small>{partner.ai}</h2></div>
            <Image src={partner.portrait} alt={partner.character} width={48} height={48} className={styles.portrait} />
          </div>
          <div className={styles.aiRow}><Image src={partner.image} alt={`${partner.character}の相棒AI・${partner.ai}`} width={140} height={140} sizes="140px" className={styles.aiImage} />
            <div><span className={styles.label}>AI診断</span><h3>{partner.ai}</h3><p>{partner.diagnosis}</p></div>
          </div>
          <div className={styles.characterRow}><span className={styles.label}>キャラ予想</span><p>{partner.prediction}</p></div>
          <nav className={styles.links} aria-label={`${partner.character}と${partner.ai}のページ`}>
            <a href={`/${key}#ai-diagnosis`}>AI診断を見る</a><a href={`/${key}#character-predictions`}>{partner.character}の予想を見る</a>
          </nav>
        </article>)}
      </div>
    </section>
  );
}

export function AiPartnerEntry() {
  return (
    <section id="ai-partners" className={styles.entrySection} aria-labelledby="prediction-entry-title">
      <div className={styles.entryHeading}>
        <span className={styles.eyebrow}>AI診断・キャラ予想</span>
        <h2 id="prediction-entry-title">得意分野から予想を選ぶ</h2>
        <p>相棒AIが診断し、3人が買い目を考えます。</p>
      </div>
      <nav className={styles.entryList} aria-label="得意分野別のAI診断とキャラ予想">
        {Object.entries(AI_PARTNERS).map(([key, partner]) => (
          <a key={key} href={`/${key}`} className={styles.entryCard} style={{ "--partner-color": partner.color }}>
            <div className={styles.entryImages}>
              <Image src={partner.portrait} alt="" width={44} height={44} className={styles.portrait} />
              <Image src={partner.image} alt="" width={40} height={40} className={styles.entryMascot} />
            </div>
            <div className={styles.entryText}>
              <h3>{partner.specialty}</h3>
              <span>{partner.character}＆{partner.ai}</span>
              <small>AI診断・予想を見る</small>
            </div>
            <b className={styles.entryArrow} aria-hidden="true">›</b>
          </a>
        ))}
      </nav>
    </section>
  );
}
