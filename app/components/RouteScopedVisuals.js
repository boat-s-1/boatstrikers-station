"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const HomeFixedWallpaper = dynamic(() => import("./HomeFixedWallpaper"));
const HomeCompactRealtime = dynamic(() => import("./HomeCompactRealtime"));
const HomeTopCleanup = dynamic(() => import("./HomeTopCleanup"));

const IchikaBackgroundOnly = dynamic(() => import("./IchikaBackgroundOnly"));
const IchikaFixedWallpaperLayer = dynamic(() => import("./IchikaFixedWallpaperLayer"));
const IchikaNewspaperBannerOverride = dynamic(() => import("./IchikaNewspaperBannerOverride"));

const HatsuneWallpaper = dynamic(() => import("./HatsuneWallpaper"));
const KiinaFixedWallpaper = dynamic(() => import("./KiinaFixedWallpaper"));

export default function RouteScopedVisuals() {
  const pathname = usePathname() || "/";

  if (pathname === "/") {
    return (
      <>
        <HomeFixedWallpaper />
        <HomeCompactRealtime />
        <HomeTopCleanup />
      </>
    );
  }

  if (pathname.includes("/ichika")) {
    return (
      <>
        <IchikaBackgroundOnly />
        <IchikaFixedWallpaperLayer />
        <IchikaNewspaperBannerOverride />
      </>
    );
  }

  if (pathname.includes("/hatsune")) {
    return <HatsuneWallpaper />;
  }

  if (pathname.includes("/kiina")) {
    return <KiinaFixedWallpaper />;
  }

  return null;
}
