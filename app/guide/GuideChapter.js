import { GuideTalk } from "./GuideConversation";
import { CHAPTER_DIALOGUE } from "./guideDialogue";
import { spokenText } from "./spokenText";
import styles from "./conversation.module.css";

// The lead speaker varies by the subject, rather than making one character a lecturer.
function specialist(text) {
  if (/穴|外枠|外側|4〜6|4・5|まくり|相手艇|オッズ|払戻|購入金額|的中率/.test(text)) return "kiina";
  if (/選手|級別|勝率|成績|モーター|周回|展示タイム|チルト|安定板|潮位|安全|購入|舟券|種類|数字の読み|初心者|確認順/.test(text)) return "hatsune";
  return "ichika";
}
const others = { ichika: ["kiina", "hatsune"], hatsune: ["kiina", "ichika"], kiina: ["hatsune", "ichika"] };

function explanationTurns(paragraphs, lead, partner) {
  // Keep every original sentence, including qualifications and numerical examples.
  return (paragraphs || []).flatMap((paragraph, index) => {
    const sentences = paragraph.match(/[^。]+。|[^。]+$/g) || [paragraph];
    const split = sentences.length > 1 ? Math.ceil(sentences.length / 2) : sentences.length;
    return [{ character: index % 2 ? partner : lead, text: sentences.slice(0, split).join("") },
      ...(split < sentences.length ? [{ character: index % 2 ? lead : partner, text: sentences.slice(split).join("") }] : [])];
  });
}

export default function GuideChapter({ section, index, topic, nextTitle }) {
  const [question, reflection] = CHAPTER_DIALOGUE[topic][index];
  const lead = specialist(section.title);
  const [questioner, partner] = others[lead];
  const turns = explanationTurns(section.paragraphs, lead, partner);
  const hasTeaching = section.points?.length || section.point || section.subsections?.length;
  return <section className={styles.chapter} id={`section-${index + 1}`}>
    <span className={styles.label}>CHAPTER {String(index + 1).padStart(2, "0")} · 3人で学ぼう</span>
    <h2>{section.title}</h2>
    <GuideTalk character={questioner} pose="ask"><p>{question}</p></GuideTalk>
    {turns.map((turn, i) => <GuideTalk key={i} character={turn.character} pose={i === 0 ? "explain" : "think"}><p>{spokenText(turn.text, turn.character)}</p></GuideTalk>)}

    <div className={styles.material}>
      <span className={styles.label}>LEARNING NOTE · 教材と重要ポイント</span>
      <h3>{section.points?.length ? "確認するポイント" : section.title}</h3>
      {section.points?.length > 0 && <ul>{section.points.map(point => <li key={point}>{point}</li>)}</ul>}
      {section.subsections?.map(subsection => <div key={subsection.title}>
        <h3>{subsection.title}</h3>
        {explanationTurns(subsection.paragraphs, specialist(subsection.title), partner).map((turn, i) => <GuideTalk key={i} character={turn.character}><p>{spokenText(turn.text, turn.character)}</p></GuideTalk>)}
      </div>)}
      {section.point && <p className={styles.keyPoint}>{section.point}</p>}
      {!hasTeaching && <p className={styles.keyPoint}>{reflection}</p>}
    </div>

    {section.comment && <GuideTalk character={section.comment.character} pose="recap"><p>{section.comment.text}</p></GuideTalk>}
    <GuideTalk character={partner} pose="recap"><p>{reflection}</p></GuideTalk>
    <div className={styles.transition}>
      <GuideTalk character={lead} pose="welcome"><p>{nextTitle ? `ここまでを踏まえて、次は「${nextTitle}」を3人で見ていこう。` : "この章までのポイントを、実際の出走表や映像で確かめてみよう。分からないところは、目次から戻って一緒に読み直そうね。"}</p></GuideTalk>
    </div>
  </section>;
}
