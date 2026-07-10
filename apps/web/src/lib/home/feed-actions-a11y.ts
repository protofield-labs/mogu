export function likeButtonAriaLabel(
  likedByMe: boolean,
  likeCount: number,
): string {
  const countSuffix = likeCount > 0 ? `（${likeCount}件）` : "";
  return likedByMe ? `いいね済み${countSuffix}` : `いいね${countSuffix}`;
}

export function likeCountLiveText(likeCount: number): string {
  if (likeCount <= 0) {
    return "いいねなし";
  }
  return `いいね ${likeCount}件`;
}

/** Photo carousel opens spot detail on tap / Enter / Space (#290). */
export const FEED_PHOTO_CAROUSEL_LABEL =
  "写真（タップまたは Enter で詳細）";
