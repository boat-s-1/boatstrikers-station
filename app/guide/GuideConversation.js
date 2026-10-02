import Image from "next/image";
import styles from "./conversation.module.css";

// These are the actual five poses in public/anime, chosen by the meaning of each turn.
export const GUIDE_CAST = {
  ichika: { name: "一果", role: "イン・1コース・逃げ", poses: {
    explain: "1ACA9B26-D8E5-4625-8D60-4656633FA558.png", think: "4E9F8775-50F8-4BC9-A353-F2222A8D0232.png",
    ask: "52491535-8caf-4b61-a6af-91cfbea6ac3b.png", recap: "93101114-89EC-4754-BD11-F1615725A394.png", welcome: "C402673C-5EB9-4B09-96CF-9FF4B6138382.png",
  } },
  hatsune: { name: "初音", role: "選手・女子戦・初心者の補足", poses: {
    think: "2DC20DA0-72ED-4B15-AB72-C7377B4DF206.png", explain: "63DB17FA-E17B-4F8E-91B2-906C201321D9.png",
    recap: "90618A5A-405E-4FC8-A9C6-D786CAF2F7F2.png", ask: "B0EA9E41-84C4-41D4-B09C-0D4023F380E0.png", welcome: "E0C288ED-9FAF-4964-B955-FA5FAB4EEC10.png",
  } },
  kiina: { name: "キイナ", role: "読者の疑問・穴・展開", poses: {
    explain: "25BDA4F5-6FC6-46B5-A7FE-1AA003E0231B.png", think: "AA33DCF0-A2C3-480B-A03A-7DAA6AF9FB1F.png",
    recap: "BCCFBCE0-19E3-4AD0-AE46-F22B6A75EEF1.png", ask: "C12025A4-CF54-450B-9644-8E400F0EB4DE.png", welcome: "CA1710C0-A632-4ED3-A1CD-6BDBE9F68F2E.png",
  } },
};

export function GuideTalk({ character, pose = "explain", children }) {
  const cast = GUIDE_CAST[character];
  return (
    <div className={`${styles.talk} ${styles[character]}`} data-speaker={character} data-pose={pose}>
      <Image className={styles.portrait} src={`/anime/${character}/${cast.poses[pose]}`} alt="" width={110} height={142} sizes="(max-width: 600px) 64px, 110px" />
      <div className={styles.speech}>
        <strong className={styles.name}>{cast.name}</strong>
        <div className={styles.bubble}>{children}</div>
      </div>
    </div>
  );
}

export function GuideCast() {
  return <div className={styles.cast}>{Object.entries(GUIDE_CAST).map(([id, cast]) => (
    <div key={id}><Image src={`/anime/${id}/${cast.poses.welcome}`} alt={cast.name} width={110} height={142} sizes="(max-width: 600px) 80px, 110px" /><strong>{cast.name}</strong><small>{cast.role}</small></div>
  ))}</div>;
}
