import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf-8"),
);

/**
 * esbuild plugin: externalise @prisma-client so the CJS Prisma generated
 * client is loaded by Node natively (where CJS require() works) instead
 * of being bundled into ESM output with a broken __require2 shim.
 */
const externalPrismaClient = {
  name: "external-prisma-client",
  setup(build) {
    build.onResolve({ filter: /^@prisma-client(?:\/.*)?$/ }, (args) => {
      const rel =
        args.path === "@prisma-client"
          ? "index.js"
          : args.path.replace(/^@prisma-client\//, "");
      return { path: `../prisma/generated/${rel}`, external: true };
    });
  },
};

export default defineConfig({
  entry: ["src/api/server/start-server.ts", "src/api/server/start-workers.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  outDir: "dist",
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: false,
  tsconfig: "tsconfig.api.json",
  external: [
    ...Object.keys(pkg.dependencies),
    ...Object.keys(pkg.devDependencies),
  ],
  esbuildPlugins: [externalPrismaClient],
});
