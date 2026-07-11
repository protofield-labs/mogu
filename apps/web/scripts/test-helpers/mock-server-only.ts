import { createRequire } from "node:module";

/** Stub `server-only` so verify scripts can import server modules under tsx (#336). */
export function installServerOnlyMock(): void {
  const require = createRequire(import.meta.url);
  const serverOnlyPath = require.resolve("server-only");
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
  } as NodeModule;
}
