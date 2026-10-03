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

const nextConfig = {
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
