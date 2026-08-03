import "./globals.css";
import PublicBottomNav from "./PublicBottomNav";
import { GoogleAnalytics } from "@next/third-parties/google";

export const metadata = {
  metadataBase: new URL("https://www.boat-strike.online"),
  title: {
    default: "BoatStrikers｜ボートレースをもっと楽しく、分かりやすく",
    template: "%s｜BoatStrikers",
  },

  description:
    "BoatStrikersは、ボートレースの出走表、展示比較、初心者講座、漫画、ラジオ、24場攻略を楽しめる情報サイトです。",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>
        {children}
        <PublicBottomNav />
      </body>
    </html>
  );
}
export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>

      <GoogleAnalytics gaId="G-DXF6FFZ574" />
    </html>
  );
}
