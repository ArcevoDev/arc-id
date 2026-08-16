import type { NextConfig } from "next";
import path from "node:path";
import fs from "node:fs";

// Canonicalize the project root to its real on-disk casing. On Windows the
// shell can report a lowercase path (C:\Users\HP\desktop\arcevodev\arc-id)
// while the real path is proper-case (C:\Users\HP\Desktop\ArcevoDev\arc-id).
// Webpack treats the two spellings as different module ids, which doubles
// Next/React/facet modules and causes "invariant expected layout router to be
// mounted" on hydration. Using the real-case root everywhere keeps module
// ids consistent.
const PROJECT_ROOT = (() => {
  try {
    return fs.realpathSync.native(process.cwd());
  } catch {
    return process.cwd();
  }
})();

/**
 * Normalize webpack module paths to their real on-disk casing.
 *
 * Webpack resolves through both the lowercase cwd and the real-case path,
 * loading Next.js internals twice -> duplicate-module warnings and, on
 * hydration, "invariant expected layout router to be mounted". This plugin
 * normalizes every resolved module path to its real-case form so each module
 * resolves exactly once.
 */
class RealCasePathPlugin {
  apply(compiler: any) {
    const realCase = (p: string) => {
      try {
        return fs.realpathSync.native(p);
      } catch {
        return p;
      }
    };

    compiler.hooks.normalModuleFactory.tap(
      "RealCasePathPlugin",
      (factory: any) => {
        factory.hooks.beforeResolve.tap("RealCasePathPlugin", (data: any) => {
          if (data?.request) data.request = realCase(data.request);
        });
        factory.hooks.afterResolve.tap("RealCasePathPlugin", (data: any) => {
          if (data?.createData?.resource) {
            data.createData.resource = realCase(data.createData.resource);
          }
        });
      },
    );
  }
}

const nextConfig: NextConfig = {
  // Explicit project root so Turbopack doesn't mis-infer the workspace
  // root from the pnpm-store layout sitting beside this repo.
  turbopack: {
    root: PROJECT_ROOT,
  },

  allowedDevOrigins: ["169.254.94.46", "localhost:3000"],

  webpack: (config) => {
    // 1) Normalize module paths to real-case (Windows casing collision).
    config.plugins = [...(config.plugins ?? []), new RealCasePathPlugin()];

    // 2) Webpack 16's CSS resolver doesn't honor the package `exports` map
    //    for CSS `@import` of subpath files. Alias the facet-tokens CSS files
    //    to their real paths so Tailwind v4 can load the @theme tokens.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@arcevo/facet-tokens/tailwind.css": path.join(
        PROJECT_ROOT,
        "node_modules/@arcevo/facet-tokens/dist/tailwind.css",
      ),
      "@arcevo/facet-tokens/tokens.css": path.join(
        PROJECT_ROOT,
        "node_modules/@arcevo/facet-tokens/dist/tokens.css",
      ),
    };
    return config;
  },

  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
    "argon2",
  ],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:4000/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
