import type { Spot, SpotRating } from "@/lib/spots/browser-api";
import { formatRatingChip } from "@/lib/home/feed-labels";

export type SpotFormState = {
  placeId: string;
  placeName: string;
  comment: string;
  rating: SpotRating;
  tagArea: string;
  tagGenre: string;
  tagSituation: string;
  freeTags: string;
  photoUrls: string[];
};

export const emptySpotForm: SpotFormState = {
  placeId: "",
  placeName: "",
  comment: "",
  rating: "again",
  tagArea: "",
  tagGenre: "",
  tagSituation: "",
  freeTags: "",
  photoUrls: [],
};

export const spotRatingOptions: { value: SpotRating; label: string }[] = [
  { value: "again", label: formatRatingChip("again") },
  { value: "either", label: formatRatingChip("either") },
  { value: "no", label: formatRatingChip("no") },
];

export function spotToForm(spot: Spot): SpotFormState {
  return {
    placeId: spot.placeId,
    placeName: "",
    comment: spot.comment,
    rating: spot.rating,
    tagArea: spot.structuredTags.area ?? "",
    tagGenre: spot.structuredTags.genre ?? "",
    tagSituation: spot.structuredTags.situation ?? "",
    freeTags: spot.freeTags.join(", "),
    photoUrls: spot.photoUrls,
  };
}
