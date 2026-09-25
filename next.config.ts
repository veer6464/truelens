import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    '10.63.166.178',
    '10.63.166.178:3000',
    '10.86.236.179',
    '10.86.236.179:3000',
    '10.210.203.178',
    '10.232.40.178',
  ],
  devIndicators: false,
};
export default nextConfig;
