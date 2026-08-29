import "./globals.css";
import "./public-header-glass.css";
import "./public-header-logo-boost.css";
import "./races-compact-overrides.css";
import "./ichika-ai-banner-fix.css";
import PublicBottomNav from "./PublicBottomNav";
import PublicSiteHeader from "./PublicSiteHeader";
import CharacterAiRoomPanel from "./components/CharacterAiRoomPanel";
import CharacterShortsShelf from "./components/CharacterShortsShelf";
import IchikaBackgroundOnly from "./components/IchikaBackgroundOnly";
import IchikaFixedWallpaperLayer from "./components/IchikaFixedWallpaperLayer";
import HatsuneWallpaper from "./components/HatsuneWallpaper";
import KiinaFixedWallpaper from "./components/KiinaFixedWallpaper";
import HomeFixedWallpaper from "./components/HomeFixedWallpaper";
import HomeCompactRealtime from "./components/HomeCompactRealtime";
import HomeTopCleanup from "./components/HomeTopCleanup";
import RaceHitFlashDeduper from "./components/RaceHitFlashDeduper";
import BetaMemberPlacementBanner from "./components/BetaMemberPlacementBanner";
import MemberSessionBridge from "./components/MemberSessionBridge";
import MemberEmailConfirmationHelper from "./components/MemberEmailConfirmationHelper";
import MemberModeQueryBridge from "./components/MemberModeQueryBridge";
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
        <MemberSessionBridge />
        <MemberModeQueryBridge />
        <PublicSiteHeader />
        <MemberEmailConfirmationHelper />
        {children}
        <BetaMemberPlacementBanner />
        <CharacterAiRoomPanel />
        <CharacterShortsShelf />
        <IchikaBackgroundOnly />
        <IchikaFixedWallpaperLayer />
        <HatsuneWallpaper />
        <KiinaFixedWallpaper />
        <HomeFixedWallpaper />
        <HomeCompactRealtime />
        <HomeTopCleanup />
        <RaceHitFlashDeduper />
        <PublicBottomNav />
        <GoogleAnalytics gaId="G-DXF6FFZ574" />
      </body>
    </html>
  );
}
