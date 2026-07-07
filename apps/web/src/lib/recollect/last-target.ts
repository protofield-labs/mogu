const STORAGE_KEY = "mogu:lastRecollectTarget";

export type LastRecollectTarget = {
  collectionId: string;
  collectionName: string;
};

export function getLastRecollectTarget(): LastRecollectTarget | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "collectionId" in parsed &&
      "collectionName" in parsed &&
      typeof parsed.collectionId === "string" &&
      typeof parsed.collectionName === "string" &&
      parsed.collectionId.length > 0 &&
      parsed.collectionName.length > 0
    ) {
      return {
        collectionId: parsed.collectionId,
        collectionName: parsed.collectionName,
      };
    }
  } catch {
    // ignore corrupt storage
  }
  return null;
}

export function setLastRecollectTarget(target: LastRecollectTarget): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(target));
}
