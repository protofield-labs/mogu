import type { PersonaKey } from "@/lib/agent/persona-config";

export type PersonaCollectionSpotSummary = {
  placeId: string;
  spotId: string;
  tagArea: string | null;
  tagGenre: string | null;
  tagSituation: string | null;
  comment: string | null;
  rating: string;
};

export type PersonaCollectionBlock = {
  personaKey: PersonaKey;
  displayName: string;
  collectionName: string;
  tags: string;
  spots: PersonaCollectionSpotSummary[];
};

/** Format demo persona collection spots for a hidden agent context turn (#264). */
export function buildPersonaCollectionContextMessage(
  blocks: PersonaCollectionBlock[],
): string {
  const lines = [
    "[ペルソナコレクション実データ]",
    "以下は友達コレクションから取得したスポットです。提案の根拠として優先して使ってください。",
    "ここに無い店を勝手に捏造しないでください。情報が足りなければ聞き返してください。",
  ];

  for (const block of blocks) {
    lines.push("");
    lines.push(
      `## ${block.displayName}のコレクション『${block.collectionName}』（${block.tags}）`,
    );
    if (block.spots.length === 0) {
      lines.push("- （スポット未取得）");
      continue;
    }
    for (const spot of block.spots) {
      const tags = [spot.tagArea, spot.tagGenre, spot.tagSituation]
        .filter(Boolean)
        .join(" / ");
      const comment = spot.comment?.trim() ? ` — ${spot.comment.trim()}` : "";
      lines.push(
        `- spot_id=${spot.spotId} place_id=${spot.placeId} rating=${spot.rating}` +
          (tags ? ` [${tags}]` : "") +
          comment,
      );
    }
  }

  return lines.join("\n");
}

export function hasPersonaCollectionSpots(
  blocks: PersonaCollectionBlock[],
): boolean {
  return blocks.some((block) => block.spots.length > 0);
}
