import type { NextConfig } from "next";
import path from "node:path";
import { createRequire } from "node:module";
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

const r = createRequire(import.meta.url);

/**
 * react-hook-form@7.x ships a `react-server` export condition whose entry
 * (./dist/react-server.esm.mjs) omits useForm / Controller / FormProvider /
 * useFormContext. facet-auth's compiled dist imports `react-hook-form` bare, so
 * under Next.js RSC Webpack resolves via `react-server` and the form hooks go
 * missing. The old alias pointed react-hook-form at the deep subpath
 * `react-hook-form/dist/index.esm.mjs`, which Webpack strict-exports rejected
 * ("Package path ./dist/index.esm.mjs is not exported"). Instead we resolve the
 * package's `import` condition to an absolute file path: an absolute path is
 * loaded directly and bypasses the `exports` map, so strict-exports is
 * satisfied while the full ESM export surface is forced.
 */
function resolveRhfImportEntry(): string {
  try {
    const facetPkgPath = r.resolve("@arcevo/facet-auth/package.json", {
      paths: [PROJECT_ROOT],
    });
    const rhfPkgPath = r.resolve("react-hook-form/package.json", {
      paths: [path.dirname(facetPkgPath)],
    });
    const rhfPkg = r(rhfPkgPath);
    const entrypoint = rhfPkg?.exports?.["."]?.import ?? "dist/index.esm.mjs";
    return path.resolve(path.dirname(rhfPkgPath), entrypoint);
  } catch {
    return "react-hook-form";
  }
}

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
        factory.hooks.afterResolve.tap("RealCasePathPlugin", (data: any) => {
          if (data?.createData?.resource) {
            const realPath = realCase(data.createData.resource);
            data.createData.resource = realPath;
            if (data.createData.userRequest) {
              data.createData.userRequest = realPath;
            }
            if (data.createData.context) {
              data.createData.context = realCase(data.createData.context);
            }
          }
        });
      },
    );
  }
}

/**
 * Hooks into enhanced-resolve's pipeline directly (at the resolver level,
 * before the module factory), so all module resolutions are normalized —
 * including imports from Next.js page entry points that may bypass
 * NormalModuleFactory hooks.
 */
class NormalizePathPlugin {
  apply(resolver: any) {
    const realCase = (p: string) => {
      try {
        return fs.realpathSync.native(p);
      } catch {
        return p;
      }
    };

    resolver.getHook("result").tapAsync(
      "NormalizePathPlugin",
      (result: any, _resolveContext: any, callback: () => void) => {
        if (result?.resource) {
          result.resource = realCase(result.resource);
        }
        callback();
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

    // Ensure symlinks are resolved so realpaths are computed for all modules.
    config.resolve.symlinks = true;

    // 2) Webpack 16's CSS resolver doesn't honor the package `exports` map
    //    for CSS `@import` of subpath files. Alias the facet-tokens CSS files
    //    to their real paths so Tailwind v4 can load the @theme tokens.
    // 3) Override Next.js's internal @/ alias to the real-case project root.
    //    Without this, Webpack resolves @/ imports through both the proper-case
    //    (C:\Users\HP\Desktop\ArceevaDev\...) and the shell's lowercase
    //    (C:\Users\HP\desktop\arcevodev\...) spellings across different
    //    compilation targets (RSC, SSR, app-pages-browser), producing
    //    duplicate-module warnings. PROJECT_ROOT is already realpathSync'd,
    //    so this canonicalizes @/ at the alias layer before the
    //    RealCasePathPlugin even runs.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.join(PROJECT_ROOT, "src"),
      "@/": path.join(PROJECT_ROOT, "src") + "/",
      "@arcevo/facet-tokens/tailwind.css": path.join(
        PROJECT_ROOT,
        "node_modules/@arcevo/facet-tokens/dist/tailwind.css",
      ),
      "@arcevo/facet-tokens/tokens.css": path.join(
        PROJECT_ROOT,
        "node_modules/@arcevo/facet-tokens/dist/tokens.css",
      ),
      // Force react-hook-form's full ESM entry (useForm, Controller, etc.)
      // instead of its `react-server` stub, resolved to an absolute path so
      // Webpack strict-exports (the package `exports` map) is satisfied.
      // See resolveRhfImportEntry above.
      "react-hook-form": resolveRhfImportEntry(),
    };

    // 4) Inject a resolver-level plugin that normalizes ALL resolved module
    //    paths to real-case. The NormalModuleFactory hooks above catch most
    //    imports, but Next.js page entry points and some internal resolution
    //    paths can bypass them. This plugin hooks into enhanced-resolve
    //    directly, ensuring every resolved resource has consistent casing.
    config.resolve.plugins = [
      ...(config.resolve.plugins ?? []),
      new NormalizePathPlugin(),
    ];

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
