/** Client-safe friendship pairId encoding (DAL re-canonicalizes via SQL). */

export function friendshipPairIdFromUserIds(a: string, b: string): string {
  if (a === b) {
    throw new Error("Friendship pair must have distinct user ids");
  }
  const json = JSON.stringify([a, b]);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
