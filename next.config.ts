import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root so it doesn't pick up the stray
  // package-lock.json one directory up.
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
  // The Docker dev stack (compose.yaml) serves `next dev` at
  // https://$DEV_HOST:<port>. Next blocks dev assets and HMR for origins
  // other than localhost unless they're listed here. Dev-only setting.
  allowedDevOrigins: process.env.DEV_HOST ? [process.env.DEV_HOST] : [],
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
