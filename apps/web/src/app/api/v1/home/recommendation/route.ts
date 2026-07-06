import { withAuthRoute } from "@/lib/auth/require-auth";
import { getHomeRecommendation } from "@/lib/dal/recommendations";

export async function GET(request: Request): Promise<Response> {
  return withAuthRoute(request, async (_req, { uid }) => {
    const recommendation = await getHomeRecommendation(uid);
    if (!recommendation) {
      // No pick for today is normal — avoid 404 noise in the browser console.
      return new Response(null, { status: 204 });
    }

    return Response.json(recommendation);
  });
}
