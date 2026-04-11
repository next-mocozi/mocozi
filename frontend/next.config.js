/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // shared 패키지의 TypeScript를 트랜스파일
  transpilePackages: ['@mocozi/shared'],
};

module.exports = nextConfig;
