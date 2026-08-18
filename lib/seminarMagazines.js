export const seminarMagazines = {
  ichika: {
    key: "ichika",
    slug: "ichika-seminar",
    name: "一果のイン逃げゼミ",
    shortName: "一果ゼミ",
    eyebrow: "毎週月曜 朝10:00公開",
    description: "イン逃げ・イン飛びをデータと実戦目線で研究する週刊マガジン。",
    hero: "/magazines/ichika/001/page-01.png",
    accent: "ichika",
    issues: [
      {
        id: "001",
        number: "創刊号",
        title: "インだから買う、を卒業する",
        date: "2026-08-24T10:00:00+09:00",
        cover: "/magazines/ichika/001/page-01.png",
        freePages: [
          "/magazines/ichika/001/page-01.png",
          "/magazines/ichika/001/page-02.png",
          "/magazines/ichika/001/page-03.png",
          "/magazines/ichika/001/page-04.png"
        ],
        premiumPageCount: 4
      }
    ]
  },
  hatsune: {
    key: "hatsune",
    slug: "hatsune-seminar",
    name: "初音の女子戦攻略新聞",
    shortName: "初音新聞",
    eyebrow: "毎週水曜 朝10:00公開",
    description: "女子戦のデータ・展示・展開を初音が読み解く女子戦専門新聞。",
    hero: "/magazines/hatsune/001/page-01.png",
    accent: "hatsune",
    issues: [
      {
        id: "001",
        number: "創刊号",
        title: "女子戦をデータで読む",
        date: "2026-08-26T10:00:00+09:00",
        cover: "/magazines/hatsune/001/page-01.png",
        freePages: [
          "/magazines/hatsune/001/page-01.png",
          "/magazines/hatsune/001/page-02.png",
          "/magazines/hatsune/001/page-03.png",
          "/magazines/hatsune/001/page-04.png"
        ],
        premiumPageCount: 4
      }
    ]
  },
  kiina: {
    key: "kiina",
    slug: "kiina-seminar",
    name: "キイナの穴党新聞",
    shortName: "キイナ新聞",
    eyebrow: "毎週金曜 朝10:00公開",
    description: "5アタマ・穴狙い・高配当条件をキイナが研究する穴党向けマガジン。",
    hero: "/magazines/kiina/001/page-01.png",
    accent: "kiina",
    issues: [
      {
        id: "001",
        number: "創刊号",
        title: "穴を買う前に見るべき条件",
        date: "2026-08-28T10:00:00+09:00",
        cover: "/magazines/kiina/001/page-01.png",
        freePages: [
          "/magazines/kiina/001/page-01.png",
          "/magazines/kiina/001/page-02.png",
          "/magazines/kiina/001/page-03.png",
          "/magazines/kiina/001/page-04.png"
        ],
        premiumPageCount: 4
      }
    ]
  }
};

export function getMagazineBySeminarSlug(slug) {
  return Object.values(seminarMagazines).find((magazine) => magazine.slug === slug);
}
