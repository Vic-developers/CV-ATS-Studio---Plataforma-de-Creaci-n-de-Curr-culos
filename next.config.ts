import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["pdfkit", "pdf-parse", "tesseract.js"],
  outputFileTracingIncludes: {
    "/api/**": [
      "./assets/fonts/*.ttf",
      "./node_modules/@tesseract.js-data/*/4.0.0_best_int/*.gz",
      "./node_modules/tesseract.js/src/worker-script/**/*",
      "./node_modules/tesseract.js-core/**/*",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
