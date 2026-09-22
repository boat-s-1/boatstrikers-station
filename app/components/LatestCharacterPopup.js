import { getPublishedNewspapers } from "../../lib/newspapers";
import LatestCharacterPopupClient from "./LatestCharacterPopupClient";

const CHARACTER = {
  ichika: {
    name: "一果",
    image: "/7562660D-EB9C-4981-A1D1-789E6211DACA.png",
    message: "予想新聞更新したよ！",
  },
  hatsune: {
    name: "初音",
    image: "/8A7A7A27-B954-4A3F-9DC3-52DB3DCE80AB.png",
    message: "女子戦の予想新聞を更新したよ！",
  },
  kiina: {
    name: "キイナ",
    image: "/6D4CA65A-8CA7-403B-AF8D-C4A6581C423F.png",
    message: "5アタマ予想新聞を更新したよ！",
  },
};

export default async function LatestCharacterPopup() {
  const latest = await getPublishedNewspapers({ limit: 1 });
  const item = latest?.[0];
  if (!item) return null;

  const character = CHARACTER[item.character_key];
  if (!character) return null;

  const href = item.slug ? `/newspapers/${item.slug}` : `/${item.character_key}`;
  const edition = item.edition === "just_before" ? "直前版" : "前日版";

  return (
    <LatestCharacterPopupClient
      id={String(item.id || item.slug || item.published_at || "latest")}
      characterKey={item.character_key}
      name={character.name}
      image={character.image}
      message={character.message}
      meta={`${edition}${item.course_name ? `・${item.course_name}${item.race_no || ""}R` : ""}`}
      title={item.title || `${character.name}の予想新聞`}
      href={href}
    />
  );
}
