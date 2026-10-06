import { blogRobots } from '../lib/blog/seo.mjs';
export const dynamic = 'force-dynamic';
const BASE_URL = "https://www.boat-strike.online";

export default function robots() {
  const preview = blogRobots(process.env.VERCEL_ENV);
  if (preview) return preview;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/blog/preview/",
        "/blog-preview/",
        "/api/",
        "/bsc2/admin/",
        "/bsc2/login/",
        "/bsc2/auth-debug/",
        "/members/",
        "/admin/schedule/login/",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
