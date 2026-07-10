export type GoogleMapsPlaceLinkOptions = {
  placeId: string;
  name?: string | null;
  location?: { lat: number; lng: number } | null;
};

/** Open Google Maps directions from the user's current location to a place. */
export function googleMapsPlaceUrl(
  placeIdOrOptions: string | GoogleMapsPlaceLinkOptions,
): string {
  const options =
    typeof placeIdOrOptions === "string"
      ? { placeId: placeIdOrOptions }
      : placeIdOrOptions;
  const params = new URLSearchParams({ api: "1" });
  params.set("destination_place_id", options.placeId);

  const trimmedName = options.name?.trim();
  if (trimmedName) {
    params.set("destination", trimmedName);
  } else if (options.location) {
    params.set(
      "destination",
      `${options.location.lat},${options.location.lng}`,
    );
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function openNowLabel(openNow: boolean | undefined): string | null {
  if (openNow === true) {
    return "営業中";
  }
  if (openNow === false) {
    return "営業時間外";
  }
  return null;
}
