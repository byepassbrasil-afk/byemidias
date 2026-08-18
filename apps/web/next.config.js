/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@byemidias/shared'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

module.exports = nextConfig;
