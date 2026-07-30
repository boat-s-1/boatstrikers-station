"use client";

import { useState } from "react";
import styles from "./comic.module.css";

const characters = [
  {
    id: "ichika",
    name: "一果",
    role: "ふなけん研究部・まとめ役",
    image: "/comic/ichika.jpeg",
    accent: "green",
    description:
      "イン逃げ研究とデータ分析が得意な、ふなけん研究部のまとめ役。部員たちの自由な行動に振り回されながらも、いつも冷静なツッコミで研究部を支えている。",
    tags: ["イン逃げ担当", "データ分析", "ツッコミ役"],
  },
  {
    id: "kiina",
    name: "キイナ",
    role: "ふなけん研究部・穴党担当",
    image: "/comic/kiina.jpeg",
    accent: "yellow",
    description:
      "明るく元気な穴党担当。5号艇と高配当をこよなく愛し、学校生活のあらゆる出来事をボートレースに例えてしまう。騒動の中心になりやすい自由人。",
    tags: ["5号艇担当", "高配当好き", "ムードメーカー"],
  },
  {
    id: "hatsune",
    name: "初音",
    role: "ふなけん研究部・女子戦担当",
    image: "/comic/hatsune.jpeg",
    accent: "purple",
    description:
      "女子戦や注目レーサーの情報収集が得意な研究部員。落ち着いた雰囲気と鋭い観察力を持ち、個性の強い二人をやさしく見守っている。",
    tags: ["女子戦担当", "情報収集", "観察力"],
  },
];

export default function CharacterGallery() {
  const [selectedId, setSelectedId] = useState("ichika");
  const selected = characters.find((character) => character.id === selectedId) || characters[0];

  return (
    <div className={styles.characterGallery}>
      <div className={styles.characterTabs} role="tablist" aria-label="登場人物を選択">
        {characters.map((character) => (
          <button
            key={character.id}
            type="button"
            role="tab"
            aria-selected={selected.id === character.id}
            className={`${styles.characterTab} ${
              selected.id === character.id ? styles.characterTabActive : ""
            }`}
            onClick={() => setSelectedId(character.id)}
          >
            <img src={character.image} alt="" aria-hidden="true" />
            <span>{character.name}</span>
          </button>
        ))}
      </div>

      <article className={`${styles.characterProfile} ${styles[`accent_${selected.accent}`]}`}>
        <div className={styles.characterPortrait}>
          <img src={selected.image} alt={`${selected.name}のキャラクター画像`} />
        </div>
        <div className={styles.characterInfo}>
          <p className={styles.characterRole}>{selected.role}</p>
          <h3>{selected.name}</h3>
          <p className={styles.characterDescription}>{selected.description}</p>
          <div className={styles.characterTags}>
            {selected.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}
