import "./globals.css";
import PublicBottomNav from "./PublicBottomNav";
import PublicSiteHeader from "./PublicSiteHeader";
import CharacterAiRoomPanel from "./components/CharacterAiRoomPanel";
import CharacterShortsShelf from "./components/CharacterShortsShelf";
import IchikaRoomTheme from "./components/IchikaRoomTheme";
import IchikaStableTheme from "./components/IchikaStableTheme";
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
        <PublicSiteHeader />
        {children}
        <CharacterAiRoomPanel />
        <CharacterShortsShelf />
        <IchikaRoomTheme />
        <IchikaStableTheme />
        <PublicBottomNav />
        <GoogleAnalytics gaId="G-DXF6FFZ574" />
      </body>
    </html>
  );
}
