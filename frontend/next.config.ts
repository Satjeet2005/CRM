import type { NextConfig } from "next";

const backendUrl =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
      {
        source: "/health/:path*",
        destination: `${backendUrl}/health/:path*`,
      },
      // Canonical route redirect /app/overview -> /app/dashboard (ADR-0004)
      {
        source: "/app/overview",
        destination: "/app/dashboard",
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/app",
        destination: "/app/dashboard",
        permanent: false,
      },
      {
        source: "/dashboard",
        destination: "/app/dashboard",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
