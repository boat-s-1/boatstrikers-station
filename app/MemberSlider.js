"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import styles from "./MemberSlider.module.css";

const members = [
  {
    name: "一果",
    href: "/ichika",
    image: "/top/6C8FAEF3-220F-4FEB-B881-220116EDDDCE.png",
    alt: "一果 イン逃げ",
  },
  {
    name: "初音",
    href: "/hatsune",
    image: "/top/2394562F-D79D-4ECA-B618-834D5BFDDDFB.png",
    alt: "初音 女子戦",
  },
  {
    name: "キイナ",
    href: "/kiina",
    image: "/top/5BA49F25-D24F-4A8E-BA45-094A604E4EDB.png",
    alt: "キイナ 穴狙い",
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
          <Link
            href={member.href}
            className={styles.card}
            key={member.name}
            aria-label={`${member.name}の部屋へ`}
          >
            <Image
              src={member.image}
              alt={member.alt}
              width={1536}
              height={2048}
              className={styles.image}
              sizes="(max-width: 720px) 88vw, 600px"
            />
          </Link>
        ))}
      </div>

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
