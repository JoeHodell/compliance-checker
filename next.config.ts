import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // proxy.ts makes Next buffer request bodies, silently truncating at 10MB by default. Brand
    // guides are often large image-heavy PDFs (URJ's is ~19MB), and a truncated multipart body
    // makes formData() throw. Allow multi-file guide uploads comfortably.
    proxyClientMaxBodySize: "100mb",
  },
};

export default nextConfig;
