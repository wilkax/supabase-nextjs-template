import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  // Set the root to parent directory since Vercel root directory is set to /nextjs
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
