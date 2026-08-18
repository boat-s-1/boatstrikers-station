/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/magazine-page': ['./private/magazines/**/*'],
  },
};

module.exports = nextConfig;
