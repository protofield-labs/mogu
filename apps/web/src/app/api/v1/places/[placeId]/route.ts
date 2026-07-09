import {
  apiErrorResponse,
  notFoundResponse,
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import {
  fetchPlaceDetails,
  PlacesApiError,
  PlacesApiNotConfiguredError,
} from "@/lib/places/google-places-client";

type RouteParams = {
  params: Promise<{ placeId: string }>;
};

export async function GET(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const { placeId } = await params;
  const normalized = placeId.trim();
  if (!normalized || normalized.length > 256) {
    return validationErrorResponse("Invalid place id");
  }

  return withAuthRoute(request, async () => {
    try {
      const place = await fetchPlaceDetails(normalized);
      if (!place) {
        return notFoundResponse("Place not found");
      }
      return Response.json(place);
    } catch (error) {
      if (error instanceof PlacesApiNotConfiguredError) {
        return apiErrorResponse("internal", error.message, 503);
      }
      // fetchPlaceDetails already maps Google 404 to null; any remaining
      // PlacesApiError (403 key/API issues, 400, 5xx) is an upstream failure.
      if (error instanceof PlacesApiError) {
        return apiErrorResponse(
          "internal",
          "Failed to fetch place details",
          502,
        );
      }
      throw error;
    }
  });
}
