import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  rewrites() {
    // fallback (not a plain array/afterFiles) so this generic rewrite is only
    // checked after Next's own dynamic routes, letting
    // app/backend/api/v1/auth/[...path]/route.ts handle auth paths itself.
    return {
      fallback: [
        {
          source: "/backend/:path*",
          destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
