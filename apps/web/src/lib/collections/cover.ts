/** Pick up to 4 distinct photo URLs from newest spots (Spotify-style mosaic). */
export function pickAutoCoverUrls(
  spots: ReadonlyArray<{ photoUrls: string[] }>,
): string[] {
  const urls: string[] = [];
  for (const spot of spots) {
    for (const url of spot.photoUrls) {
      if (!url || urls.includes(url)) {
        continue;
      }
      urls.push(url);
      if (urls.length >= 4) {
        return urls;
      }
    }
  }
  return urls;
}

export function resolveDisplayCoverUrl(collection: {
  coverUrl: string | null;
  autoCoverUrls?: string[];
}): string | null {
  if (collection.coverUrl) {
    return collection.coverUrl;
  }
  return collection.autoCoverUrls?.[0] ?? null;
}
