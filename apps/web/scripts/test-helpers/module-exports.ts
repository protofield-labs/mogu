import { assert } from "./assert";

/** Assert a named export exists and is a function (#336). */
export function assertExportedFunction(
  mod: Record<string, unknown>,
  exportName: string,
  label: string,
): void {
  assert(typeof mod[exportName] === "function", label);
}
