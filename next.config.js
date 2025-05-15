/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Warning: This allows production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  webpack(config) {
    // Configure webpack to handle JSON files with spaces in their names
    config.module.rules.push({
      test: /\.json$/,
      type: 'javascript/auto',
      loader: 'json-loader',
    });
    
    return config;
  },
}

module.exports = nextConfig;