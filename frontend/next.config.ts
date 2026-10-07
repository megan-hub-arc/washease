import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["unlikely-jokes-ala-preceding.trycloudflare.com"],
  reactCompiler: true,
};

export default nextConfig;