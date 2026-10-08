import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Speed: strip console in prod, compress, no powered-by header
  compress: true,
  poweredByHeader: false,
  images: {
    // modern formats first = smaller bytes for the same quality
    formats: ["image/avif", "image/webp"],
    // tight sizes: landing images rarely need more than 1080w
    deviceSizes: [360, 640, 768, 1080],
    imageSizes: [128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // cache static assets aggressively; HTML stays dynamic per product
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        // Uploaded product images are content-addressed (timestamp+rand names,
        // never overwritten) → safe to cache immutably for a year.
        source: "/uploads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
