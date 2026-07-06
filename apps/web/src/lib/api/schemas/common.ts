import { z } from "zod";

export const uuidRouteParamsSchema = z.object({
  id: z.string().uuid(),
});
