const BASE_URL = "https://www.boat-strike.online";

const STADIUMS = [
  "桐生",
  "戸田",
  "江戸川",
  "平和島",
  "多摩川",
  "浜名湖",
  "蒲郡",
  "常滑",
  "津",
  "三国",
  "びわこ",
  "住之江",
  "尼崎",
  "鳴門",
  "丸亀",
  "児島",
  "宮島",
  "徳山",
  "下関",
  "若松",
  "芦屋",
  "福岡",
  "唐津",
  "大村",
];

export default function sitemap() {
  const lastModified = new Date();

  const staticPages = [
    { path: "", changeFrequency: "daily", priority: 1 },
    { path: "/races", changeFrequency: "daily", priority: 0.9 },
    { path: "/schedule", changeFrequency: "daily", priority: 0.8 },
    { path: "/results", changeFrequency: "daily", priority: 0.8 },
    { path: "/comic", changeFrequency: "weekly", priority: 0.8 },
    { path: "/ichika-sensei", changeFrequency: "weekly", priority: 0.8 },
    { path: "/radio", changeFrequency: "weekly", priority: 0.8 },
    { path: "/library", changeFrequency: "weekly", priority: 0.8 },
    { path: "/library/free", changeFrequency: "weekly", priority: 0.7 },
    { path: "/library/ichika-seminar", changeFrequency: "weekly", priority: 0.7 },
    { path: "/library/hatsune-seminar", changeFrequency: "weekly", priority: 0.7 },
    { path: "/library/kiina-seminar", changeFrequency: "weekly", priority: 0.7 },
    { path: "/library/stadiums", changeFrequency: "weekly", priority: 0.8 },
    { path: "/ichika", changeFrequency: "weekly", priority: 0.7 },
    { path: "/hatsune", changeFrequency: "weekly", priority: 0.7 },
    { path: "/kiina", changeFrequency: "weekly", priority: 0.7 },
    { path: "/bsc", changeFrequency: "monthly", priority: 0.6 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.4 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.4 },
    { path: "/disclaimer", changeFrequency: "yearly", priority: 0.4 },
    { path: "/contact", changeFrequency: "yearly", priority: 0.4 },
  ];

  const staticEntries = staticPages.map((page) => ({
    url: `${BASE_URL}${page.path}`,
    lastModified,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  const stadiumEntries = STADIUMS.map((stadium) => ({
    url: `${BASE_URL}/library/stadium/${encodeURIComponent(stadium)}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticEntries, ...stadiumEntries];
}
