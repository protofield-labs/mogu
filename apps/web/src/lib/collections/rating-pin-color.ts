import type { SpotRating } from "@/lib/spot/types";

const RATING_PIN_COLOR: Record<SpotRating, string> = {
  again: "#16a34a",
  either: "#64748b",
  no: "#dc2626",
};

export function ratingPinColor(rating: SpotRating): string {
  return RATING_PIN_COLOR[rating];
}
