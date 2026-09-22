import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  // Keep dev artifacts separate from a standalone production build. This
  // avoids Windows following standalone's pnpm symlinks during next dev.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    dangerouslyAllowSVG: true,
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },
  async rewrites() {
  // Keep the prototype deployment self-contained; external BFF access is an
  // explicit opt-in only.
    if (process.env.NEXT_PUBLIC_PROTOTYPE_MODE !== "external") {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_BFF_ORIGIN || "http://localhost:18080"}/api/:path*`,
      },
    ];
  },
};

export default bundleAnalyzer(nextConfig);
