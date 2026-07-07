import { parseJsonBody } from "@/lib/api/parse-json-body";
import {
  apiErrorResponse,
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import {
  placeLocationListSchema,
  placeLocationsRequestSchema,
} from "@/lib/api/schemas/places";
import {
  fetchPlaceLocations,
  PlacesApiError,
  PlacesApiNotConfiguredError,
} from "@/lib/places/google-places-client";

export async function POST(request: Request): Promise<Response> {
  const parsed = await parseJsonBody(request, placeLocationsRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  return withAuthRoute(request, async () => {
    try {
      const places = await fetchPlaceLocations(parsed.data.placeIds);
      return Response.json(placeLocationListSchema.parse(places));
    } catch (error) {
      if (error instanceof PlacesApiNotConfiguredError) {
        return apiErrorResponse("internal", error.message, 503);
      }
      if (error instanceof PlacesApiError) {
        return apiErrorResponse(
          "internal",
          "Failed to fetch place locations",
          502,
        );
      }
      throw error;
    }
  });
}

export async function GET(): Promise<Response> {
  return validationErrorResponse("Method not allowed");
}
