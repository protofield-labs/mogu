type FeedCursor = {
  createdAt: Date;
  id: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeFeedCursor(createdAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ t: createdAt.toISOString(), id }),
    "utf8",
  ).toString("base64url");
}

export function decodeFeedCursor(cursor: string): FeedCursor | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as { t?: unknown; id?: unknown };
    if (typeof parsed.t !== "string" || typeof parsed.id !== "string") {
      return null;
    }
    // Spot ids are UUID columns; reject anything else before it reaches SQL.
    if (!UUID_PATTERN.test(parsed.id)) {
      return null;
    }
    const createdAt = new Date(parsed.t);
    if (Number.isNaN(createdAt.getTime())) {
      return null;
    }
    return { createdAt, id: parsed.id };
  } catch {
    return null;
  }
}
