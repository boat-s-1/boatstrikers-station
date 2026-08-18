export const seminarMagazines = {
  ichika: {
    slug: "ichika-seminar",
    name: "一果のイン逃げ鉄板ゼミ",
    shortName: "一果ゼミ",
    eyebrow: "毎週月曜更新",
    description: "イン逃げ・イン飛びをデータと実戦目線で研究する週刊マガジン。",
    hero: "/5A4C4D12-46D8-45A1-A1B6-D14637B81FE4.png",
    accent: "ichika",
    issues: [
      {
        id: "001",
        number: "創刊号",
        title: "インだから買う、を卒業する",
        date: "2026-08-24",
        cover: "/5A4C4D12-46D8-45A1-A1B6-D14637B81FE4.png",
        pages: [
          "/5A4C4D12-46D8-45A1-A1B6-D14637B81FE4.png",
          "/ichika-banner.jpg",
          "/comic/ichika.jpeg"
        ],
        premiumFrom: 3
      }
    ]
  },
  hatsune: {
    slug: "hatsune-seminar",
    name: "初音の女子戦攻略マガジン",
    shortName: "初音ゼミ",
    eyebrow: "毎週水曜更新",
    description: "女子戦のデータ・展示・展開を初音が読み解く女子戦専門マガジン。",
    hero: "/D5E40BCC-AA6E-4347-B86B-9D0FE4BF4833.png",
    accent: "hatsune",
    issues: [
      {
        id: "001",
        number: "創刊号",
        title: "女子戦をデータで読む",
        date: "2026-08-26",
        cover: "/D5E40BCC-AA6E-4347-B86B-9D0FE4BF4833.png",
        pages: [
          "/D5E40BCC-AA6E-4347-B86B-9D0FE4BF4833.png",
          "/hatsune-banner.jpg",
          "/hatsune-hero.png"
        ],
        premiumFrom: 3
      }
    ]
  },
  kiina: {
    slug: "kiina-seminar",
    name: "キイナの穴党新聞",
    shortName: "キイナゼミ",
    eyebrow: "毎週金曜更新",
    description: "5アタマ・穴狙い・高配当条件をキイナが研究する穴党向けマガジン。",
    hero: "/6716D6BF-80F0-415A-BC81-0270FB704655.png",
    accent: "kiina",
    issues: [
      {
        id: "001",
        number: "創刊号",
        title: "穴を買う前に見るべき条件",
        date: "2026-08-28",
        cover: "/6716D6BF-80F0-415A-BC81-0270FB704655.png",
        pages: [
          "/6716D6BF-80F0-415A-BC81-0270FB704655.png",
          "/kiina-banner.jpg",
          "/kiina-hero.png"
        ],
        premiumFrom: 3
      }
    ]
  }
};

export function getMagazineBySeminarSlug(slug) {
  return Object.values(seminarMagazines).find((magazine) => magazine.slug === slug);
}
