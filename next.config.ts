import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Allow development access from LAN IPs (e.g., 192.168.x.x) to dev assets.
   * Adjust or remove for production.
   */
  experimental: {
    allowedDevOrigins: ["http://localhost:3000", "http://192.168.50.179:3000"],
  },
  poweredByHeader: false,
};

export default nextConfig;
