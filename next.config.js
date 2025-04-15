/** @type {import('next').NextConfig} */
const rewrites = () => {
  return [
    {
      source: "/api/:path*",
      destination: "https://laicuinan.cn/chat_api/api/:path*",
    },
  ];
};
const nextConfig = {
  // 基础路径配置（适用于部署在子目录）
  basePath: process.env.BASE_PATH || '', 
    // 静态资源路径前缀
  assetPrefix: process.env.BASE_PATH || '', 
  rewrites,
  experimental: {
    appDir: true,
  },
  output:'standalone',
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    }); // 针对 SVG 的处理规则

    return config;
  },
};

module.exports = nextConfig;
