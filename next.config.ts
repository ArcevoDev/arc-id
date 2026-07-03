import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Move this directly to the root of the config object
  allowedDevOrigins: ["169.254.94.46", "localhost:3000"],

  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
    "argon2",
  ],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:4000/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
