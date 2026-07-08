export type CollectionConsultContext =
  | { kind: "collection"; collectionId: string; collectionName: string }
  | { kind: "first-spot" };

/** User-visible copy shown in the chat transcript after handoff (#239). */
export function collectionConsultDisplayMessage(
  context: CollectionConsultContext,
): string {
  if (context.kind === "collection") {
    return `「${context.collectionName}」に合うお店を探しましょう。`;
  }
  return "最初のお店探しを手伝います。エリアや人数を教えてください。";
}

/** Hidden user turn that seeds the orchestrator with collection context (#239). */
export function buildCollectionContextMessage(
  context: CollectionConsultContext,
): string {
  if (context.kind === "collection") {
    return [
      "[コレクションからの相談コンテキスト]",
      `コレクションID: ${context.collectionId}`,
      `コレクション名: ${context.collectionName}`,
      "ユーザーはこのコレクションに合うお店を探したいと考えています。上記を踏まえて会話してください。",
    ].join("\n");
  }
  return [
    "[マイページからの相談コンテキスト]",
    "ユーザーはまだスポットを登録していません。最初のお店探しの相談を手伝ってください。",
  ].join("\n");
}
