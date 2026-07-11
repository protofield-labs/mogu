import type { AgentPersonaConfig } from "@/lib/agent/persona-config";
import { isPersonaCoreSpotId } from "@/lib/agent/persona-config";

export type PersonaSpotRow = {
  id: string;
  placeId: string;
  tagArea: string | null;
  tagGenre: string | null;
  tagSituation: string | null;
  comment: string;
  createdAt: Date;
};

export function buildPersonaSearchQuery(
  persona: AgentPersonaConfig,
  sampleSpot: PersonaSpotRow | undefined,
): string {
  const area = sampleSpot?.tagArea?.trim() || "中目黒";
  const genre =
    sampleSpot?.tagGenre?.trim() ||
    persona.tagsSlash.split("/")[0]?.trim() ||
    "居酒屋";
  const situation =
    sampleSpot?.tagSituation?.trim() ||
    persona.tagsSlash.split("/")[1]?.trim() ||
    "サク飲み";
  return `${area} ${genre} ${situation}`.trim();
}

export function isRotatablePersonaSpot(spotId: string): boolean {
  return !isPersonaCoreSpotId(spotId);
}

export const PERSONA_CURATION_WEEKLY_ADD_LIMIT = 1;

export const PERSONA_CURATION_MAX_ACTIVE_SPOTS = 6;
