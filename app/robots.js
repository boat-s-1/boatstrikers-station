const BASE_URL = "https://www.boat-strike.online";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
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
