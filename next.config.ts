import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /**
     * Keeps a prefetched dashboard tab in the client router cache
     * instead of refetching it on every click.
     *
     * Every page under (dash) is a client component reading from the
     * store, and the layout is dynamic because it reads the session
     * cookie -- so `dynamic` defaults to 0 and each tab switch paid for
     * a fresh RSC round trip before it would render. Five minutes is
     * safely inside the twelve-hour session, and the data itself still
     * comes from /api/db on every refresh, so nothing goes stale.
     */
    staleTimes: {
      dynamic: 300,
      static: 300,
    },
  },
};

export default nextConfig;
