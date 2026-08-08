"use client";

import Script from "next/script";

export default function XTimeline() {
  return (
    <div>
      <a
        className="twitter-timeline"
        href="https://x.com/boatstrikers?ref_src=twsrc%5Etfw"
        data-height="520"
        data-theme="light"
      >
        Posts by boatstrikers
      </a>

      <Script
        src="https://platform.x.com/widgets.js"
        strategy="lazyOnload"
        charSet="utf-8"
      />
    </div>
  );
}
