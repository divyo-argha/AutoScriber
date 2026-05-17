import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ['fluent-ffmpeg'],
  allowedDevOrigins: [
    '.space.chatglm.site',
    '.space-z.ai',
  ],
};

export default nextConfig;
