/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // 局域网调试：允许整段内网网段访问 dev 资源，避免每次换 IP 都要改配置
  allowedDevOrigins: [
    "10.235.120.10",
    "10.235.120.6",
    "10.235.120.235",
    "*.local",
    "10.235.120.*",
  ],
}

export default nextConfig
