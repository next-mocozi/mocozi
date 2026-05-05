import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mocozi/shared'],
  turbopack: {},
};

export default nextConfig;
