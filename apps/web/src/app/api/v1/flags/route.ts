import { z } from "zod";

import {
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { listFlagNotifications } from "@/lib/dal/flags";

const weekOfSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function GET(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    const weekOf = new URL(req.url).searchParams.get("weekOf");
    if (weekOf !== null && !weekOfSchema.safeParse(weekOf).success) {
      return validationErrorResponse("Invalid weekOf date (YYYY-MM-DD)");
    }

    const notifications = await listFlagNotifications(uid, weekOf);
    if (notifications === null) {
      return validationErrorResponse("Invalid weekOf date (YYYY-MM-DD)");
    }

    return Response.json(notifications);
  });
}
