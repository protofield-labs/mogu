import type { Spot } from "@/lib/home/types";

const RATING_CHIP: Record<Spot["rating"], string> = {
  again: "また行きたい",
  either: "どちらでも",
  no: "また行きたくない",
};

export function formatRatingChip(rating: Spot["rating"]): string {
  return RATING_CHIP[rating];
}

export function formatViaLabel(actorDisplayName: string): string {
  return `via ${actorDisplayName}`;
}

export function formatSavedCountBadge(savedCount: number): string | null {
  if (savedCount <= 0) {
    return null;
  }
  return `輪で${savedCount}人`;
}

type StructuredTags = {
  area?: string | null;
  genre?: string | null;
  situation?: string | null;
};

type SpotTagSource = {
  structuredTags: StructuredTags;
  freeTags: string[];
};

export function formatSpotTagChips(spot: SpotTagSource): string[] {
  const structured = spot.structuredTags as StructuredTags;
  const structuredTags = [structured.area, structured.genre, structured.situation].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return [...structuredTags, ...spot.freeTags];
}
