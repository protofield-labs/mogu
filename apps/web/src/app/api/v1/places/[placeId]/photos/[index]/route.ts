import {
  apiErrorResponse,
  notFoundResponse,
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import {
  fetchPlacePhotoMedia,
  PlacesApiError,
  PlacesApiNotConfiguredError,
} from "@/lib/places/google-places-client";

type RouteParams = {
  params: Promise<{ placeId: string; index: string }>;
};

export async function GET(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const { placeId, index: indexRaw } = await params;
  const normalized = placeId.trim();
  const index = Number.parseInt(indexRaw, 10);

  if (!normalized || Number.isNaN(index) || index < 0 || index > 4) {
    return validationErrorResponse("Invalid place photo request");
  }

  return withAuthRoute(request, async () => {
    try {
      const media = await fetchPlacePhotoMedia(normalized, index);
      if (!media) {
        return notFoundResponse("Place photo not found");
      }

      return new Response(media.body, {
        headers: {
          "Content-Type": media.contentType,
          "Cache-Control": "private, max-age=3600",
        },
      });
    } catch (error) {
      if (error instanceof PlacesApiNotConfiguredError) {
        return apiErrorResponse("internal", error.message, 503);
      }
      if (error instanceof PlacesApiError) {
        return apiErrorResponse(
          "internal",
          "Failed to fetch place photo",
          502,
        );
      }
      throw error;
    }
  });
}
