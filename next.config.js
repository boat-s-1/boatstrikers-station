/** @type {import('next').NextConfig} */
const { slugRedirects } = require('./lib/blog/slugRedirects.cjs');
const stadiumRedirects = [
  ['桐生', 'kiryu'],
  ['戸田', 'toda'],
  ['江戸川', 'edogawa'],
  ['平和島', 'heiwajima'],
  ['多摩川', 'tamagawa'],
  ['浜名湖', 'hamanako'],
  ['蒲郡', 'gamagori'],
  ['常滑', 'tokoname'],
  ['津', 'tsu'],
  ['三国', 'mikuni'],
  ['びわこ', 'biwako'],
  ['住之江', 'suminoe'],
  ['尼崎', 'amagasaki'],
  ['鳴門', 'naruto'],
  ['丸亀', 'marugame'],
  ['児島', 'kojima'],
  ['宮島', 'miyajima'],
  ['徳山', 'tokuyama'],
  ['下関', 'shimonoseki'],
  ['若松', 'wakamatsu'],
  ['芦屋', 'ashiya'],
  ['福岡', 'fukuoka'],
  ['唐津', 'karatsu'],
  ['大村', 'omura'],
].map(([name, slug]) => ({
  source: `/library/stadium/${name}`,
  destination: `/library/stadium/${slug}`,
  permanent: true,
}));

// AI cover rendering (lib/blog/ai/cover.mjs) reads character art with readFile(process.cwd()/public/...),
// which makes the file tracer copy all of public/ (~500MB) into every AI function. Exclude public/ there and
// ship only the art covers can use (every pose of the three guide characters).
// tests/blog/aiFollowups.test.mjs checks every coverable pose is still included.
const AI_FUNCTIONS = ['/admin/blog/ai', '/api/admin/blog/ai/**', '/api/cron/blog-ai-drafts'];
const AI_COVER_IMAGES = ['ichika', 'hatsune', 'kiina'].map(character => `public/anime/${character}/*.png`);

const nextConfig = {
  outputFileTracingExcludes: Object.fromEntries(AI_FUNCTIONS.map(route => [route, ['public/**']])),
  outputFileTracingIncludes: Object.fromEntries(AI_FUNCTIONS.map(route => [route, AI_COVER_IMAGES])),
  async headers() {
    const isolation = ['/blog/preview/:path*', '/blog-preview/:path*'];
    if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') isolation.push('/blog', '/blog/:path*');
    return isolation.map(source => ({
      source,
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        { key: 'Cache-Control', value: 'private, no-store' },
      ],
    }));
  },
  async redirects() {
    return [...stadiumRedirects, ...slugRedirects()];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/ai-results",
          destination: "/ai-results-full",
        },
      ],
    };
  },
};

module.exports = nextConfig;
