import { notFoundResponse, withAuthRoute } from "@/lib/auth/require-auth";
import { getHomeRecommendation } from "@/lib/dal/recommendations";

export async function GET(request: Request): Promise<Response> {
  return withAuthRoute(request, async (_req, { uid }) => {
    const recommendation = await getHomeRecommendation(uid);
    if (!recommendation) {
      return notFoundResponse("No recommendation for today");
    }

    return Response.json(recommendation);
  });
}
