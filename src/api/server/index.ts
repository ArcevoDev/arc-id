// src/api/server/index.ts
export * from "./build-server";
// start-server.ts and start-workers.ts are process entrypoints, not library modules.
// They are invoked directly via package.json scripts — never imported.
