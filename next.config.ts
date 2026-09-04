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
     * a fresh RSC round trip before it would render. Five minutes stays
     * inside the twenty-minute session, so a cached tab cannot outlive
     * the session it was rendered for, and the data itself still comes
     * from /api/db on every refresh, so nothing goes stale.
     */
    staleTimes: {
      dynamic: 300,
      static: 300,
    },
  },

  /**
   * Files in `public/` are served with `max-age=0` by default, so the
   * background video was revalidated on every single page load. It is by
   * far the largest asset the panel ships and it changes about never, so
   * a day of browser cache removes that round trip without making a
   * replacement take longer than a day to reach anyone.
   */
  async headers() {
    const cacheForADay = [{ key: "Cache-Control", value: "public, max-age=86400" }];
    return [
      { source: "/background.mp4", headers: cacheForADay },
      { source: "/background-poster.jpg", headers: cacheForADay },
    ];
  },
};

export default nextConfig;
