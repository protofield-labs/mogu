/**
 * Candidate spot markers in agent replies (#287).
 * The orchestrator appends `[[候補 spot_id=… place_id=…]]` lines (from the
 * persona collection prefetch, #264) when suggesting candidates. The server
 * strips these lines from the user-visible text and builds thumbnail cards.
 */

export type CandidateSpotMarker = {
  spotId: string;
  placeId: string;
};

export const MAX_CANDIDATE_SPOTS = 3;

/** Fixed user turn sent when a candidate card is tapped (#287). */
export const CANDIDATE_FOLLOWUP_TEXT = "この店について詳しく教えて";

/** Shown when the model replied with marker lines only (markers stay hidden). */
export const CANDIDATE_ONLY_REPLY_TEXT =
  "こちらの候補はいかがでしょう。気になるお店をタップすると詳しくお話しします。";

// ID charsets are intentionally loose (`[^\s\]]`): Google does not guarantee
// a place_id alphabet, and a single unexpected character must not drop the
// whole card row. Hallucinated values are filtered later against the DB.
const CANDIDATE_MARKER_PATTERN =
  /\[\[\s*候補\s+spot_id=([^\s\]]+)\s+place_id=([^\s\]]+)\s*\]\]/g;

export type ExtractedCandidateMarkers = {
  /** Reply text with marker lines removed (original text if it would become empty). */
  text: string;
  markers: CandidateSpotMarker[];
};

export function extractCandidateSpotMarkers(
  text: string,
): ExtractedCandidateMarkers {
  const markers: CandidateSpotMarker[] = [];
  const seenSpotIds = new Set<string>();

  const stripped = text.replace(
    CANDIDATE_MARKER_PATTERN,
    (_match, spotId: string, placeId: string) => {
      if (!seenSpotIds.has(spotId) && markers.length < MAX_CANDIDATE_SPOTS) {
        seenSpotIds.add(spotId);
        markers.push({ spotId, placeId });
      }
      return "";
    },
  );

  if (markers.length === 0) {
    return { text: text.trim(), markers };
  }

  const cleaned = stripped
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Never blank the bubble, and never leak raw marker syntax (#287).
  return { text: cleaned || CANDIDATE_ONLY_REPLY_TEXT, markers };
}
