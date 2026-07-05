import {
  apiErrorResponse,
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import {
  PlacesApiError,
  PlacesApiNotConfiguredError,
  searchPlaces,
} from "@/lib/places/google-places-client";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  if (!query || query.trim().length === 0) {
    return validationErrorResponse("Query parameter q is required");
  }

  return withAuthRoute(request, async () => {
    try {
      const results = await searchPlaces(query);
      return Response.json(results);
    } catch (error) {
      if (error instanceof PlacesApiNotConfiguredError) {
        return apiErrorResponse("internal", error.message, 503);
      }
      if (error instanceof PlacesApiError) {
        return apiErrorResponse("internal", "Places search failed", 502);
      }
      throw error;
    }
  });
}
