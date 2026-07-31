"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import styles from "./MemberSlider.module.css";

const members = [
  {
    name: "一果",
    role: "イン逃げ担当",
    href: "/ichika",
    image: "/ichika-banner.jpg",
    alt: "一果の部屋",
  },
  {
    name: "初音",
    role: "女子戦担当",
    href: "/hatsune",
    image: "/hatsune-banner.jpg",
    alt: "初音の部屋",
  },
  {
    name: "キイナ",
    role: "5アタマ担当",
    href: "/kiina",
    image: "/kiina-banner.jpg",
    alt: "キイナの部屋",
  },
];

export default function MemberSlider() {
  const sliderRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  function updateActiveIndex() {
    const slider = sliderRef.current;
    if (!slider) return;

    const cards = Array.from(slider.children);
    const sliderCenter = slider.scrollLeft + slider.clientWidth / 2;

    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    cards.forEach((card, index) => {
      const cardCenter = card.offsetLeft + card.clientWidth / 2;
      const distance = Math.abs(cardCenter - sliderCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setActiveIndex(closestIndex);
  }

  function goTo(index) {
    const slider = sliderRef.current;
    const card = slider?.children[index];
    if (!slider || !card) return;

    slider.scrollTo({
      left: card.offsetLeft - (slider.clientWidth - card.clientWidth) / 2,
      behavior: "smooth",
    });

    setActiveIndex(index);
  }

  return (
    <div className={styles.wrapper}>
      <div
        ref={sliderRef}
        className={styles.slider}
        onScroll={updateActiveIndex}
        aria-label="メンバー紹介"
      >
        {members.map((member) => (
          <article className={styles.card} key={member.name}>
            <Image
              src={member.image}
              alt={member.alt}
              width={1536}
              height={1080}
              className={styles.image}
              sizes="(max-width: 720px) 88vw, 600px"
            />

            <div className={styles.cardFooter}>
              <div>
                <strong>{member.name}</strong>
                <span>{member.role}</span>
              </div>

              <Link href={member.href} className={styles.roomLink}>
                {member.name}の部屋へ
                <span aria-hidden="true">›</span>
              </Link>
            </div>
          </article>
        ))}
      </div>

      <p className={styles.swipeHint}>← 横にスワイプ →</p>

      <div className={styles.dots} aria-label="表示中のメンバー">
        {members.map((member, index) => (
          <button
            key={member.name}
            type="button"
            className={`${styles.dot} ${
              activeIndex === index ? styles.activeDot : ""
            }`}
            onClick={() => goTo(index)}
            aria-label={`${member.name}を表示`}
            aria-current={activeIndex === index ? "true" : undefined}
          />
        ))}
      </div>
    </div>
  );
}
