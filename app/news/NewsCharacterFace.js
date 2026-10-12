import Image from "next/image";
import { NEWS_CHARACTERS } from "../../lib/newsTaxonomy";
import styles from "./newsTheme.module.css";

// 正式画像（public/popup, 1086×1448）から顔の部分だけを表示する。画像は next/image で表示サイズに縮小して配信される。
const SOURCE = { width: 1086, height: 1448, crop: 680 };
const FACE_ORIGIN = { ichika: [200, 90], hatsune: [200, 190], kiina: [200, 110] };

export default function NewsCharacterFace({ character, size = 28, pose = "normal", title }) {
  const data = NEWS_CHARACTERS[character];
  if (!data) return null;
  const [x0, y0] = FACE_ORIGIN[character];
  const width = Math.round((size * SOURCE.width) / SOURCE.crop);
  const height = Math.round((width * SOURCE.height) / SOURCE.width);
  return (
    <span className={`${styles.face} ${styles[`face_${character}`]}`} style={{ width: size, height: size }} title={title || data.name}>
      <Image
        src={pose === "point" ? data.pointImage : data.image}
        alt={data.name}
        width={width}
        height={height}
        style={{ left: -Math.round((x0 / SOURCE.width) * width), top: -Math.round((y0 / SOURCE.height) * height) }}
      />
    </span>
  );
}

// 記事詳細の案内枠用の上半身表示。
export function NewsCharacterBust({ character, width = 78, height = 88 }) {
  const data = NEWS_CHARACTERS[character];
  if (!data) return null;
  const imageWidth = Math.round(width * 1.25);
  const imageHeight = Math.round((imageWidth * SOURCE.height) / SOURCE.width);
  return (
    <span className={styles.bust} style={{ width, height }}>
      <Image src={data.pointImage} alt={data.name} width={imageWidth} height={imageHeight} style={{ left: -Math.round((imageWidth - width) / 2), top: 0 }} />
    </span>
  );
}
