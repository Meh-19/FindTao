import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (node .next/standalone/server.js).
  output: "standalone",
  // Pin the tracing root to this project — a stray lockfile in a parent directory
  // otherwise makes Next nest the standalone output under the wrong root.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
