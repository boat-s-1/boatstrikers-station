export const metadata = {
  title: "AI予想成績",
  description: "BoatStrikersのAI予想について、実際の買い目を100円単位で集計した的中率・回収率・収支を公開しています。",
  alternates: { canonical: "/ai-results" },
  openGraph: {
    title: "AI予想成績｜BoatStrikers",
    description: "BoatStrikers AI予想の的中率・回収率・収支を公開。",
    url: "/ai-results",
    type: "website",
  },
};

export default function AiResultsLayout({ children }) {
  return children;
}
