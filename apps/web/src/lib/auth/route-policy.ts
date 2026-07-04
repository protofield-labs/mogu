/** Public API prefixes (no Bearer required). All other /api/v1/* require auth (#14). */
export const PUBLIC_API_PREFIXES = ["/api/health"] as const;

export function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
