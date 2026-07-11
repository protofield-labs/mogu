import { DEMO_VIEWER_DEFAULT } from "@/lib/seed/demo-data";
import { DEMO_PERSONA_SPOT_ID_PREFIX } from "@/lib/agent/persona-config";

/** spot.id column — reject hallucinated marker ids before Prisma queries. */
const SPOT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export { DEMO_PERSONA_SPOT_ID_PREFIX };

export function isValidSpotUuid(spotId: string): boolean {
  return SPOT_UUID_PATTERN.test(spotId);
}

export function isDemoPersonaSpotId(spotId: string): boolean {
  return (
    isValidSpotUuid(spotId) && spotId.startsWith(DEMO_PERSONA_SPOT_ID_PREFIX)
  );
}

/** Demo seed viewer — friendships with Ken/Aoi unlock persona collection RLS. */
export const DEMO_PERSONA_VIEWER_UID = DEMO_VIEWER_DEFAULT.uid;
