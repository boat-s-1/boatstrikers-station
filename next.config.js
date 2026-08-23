/** @type {import('next').NextConfig} */
const nextConfig = {
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
