import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse loads a pdf.js worker file by path at runtime. When Next bundles it into the
  // production build that file isn't emitted ("Cannot find module .../pdf.worker.mjs"), so
  // every PDF parse fails in production even though it works under `next dev`. Load these
  // from node_modules instead of bundling them.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  experimental: {
    // proxy.ts makes Next buffer request bodies, silently truncating at 10MB by default. Brand
    // guides are often large image-heavy PDFs (URJ's is ~19MB), and a truncated multipart body
    // makes formData() throw. Allow multi-file guide uploads comfortably.
    proxyClientMaxBodySize: "100mb",
  },
};

export default nextConfig;
