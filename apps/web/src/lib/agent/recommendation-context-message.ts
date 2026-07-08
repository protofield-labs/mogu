import type { Recommendation } from "@/lib/agent/types";

export type RecommendationContextInput = {
  placeId: string;
  spotId: string;
  assertion: string;
  evidence: string;
  placeName?: string | null;
};

/** Hidden user turn that seeds the orchestrator with home recommendation context (#204). */
export function buildRecommendationContextMessage(
  input: RecommendationContextInput,
): string {
  return [
    "[ホーム一推しからの相談コンテキスト]",
    ...(input.placeName?.trim()
      ? [`店名: ${input.placeName.trim()}`]
      : []),
    `おすすめスポット place_id: ${input.placeId}`,
    `スポットID: ${input.spotId}`,
    `断言: ${input.assertion}`,
    `根拠: ${input.evidence}`,
    "ユーザーはこのお店について質問する可能性があります。上記を踏まえて会話してください。",
  ].join("\n");
}

export function recommendationToContext(
  recommendation: Recommendation,
): RecommendationContextInput {
  return {
    placeId: recommendation.spot.placeId,
    spotId: recommendation.spot.id,
    assertion: recommendation.assertion,
    evidence: recommendation.evidence,
  };
}
