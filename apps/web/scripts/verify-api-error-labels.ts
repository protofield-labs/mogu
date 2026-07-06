/**
 * User-facing API error label verification (#89 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-api-error-labels.ts
 */
import { assert } from "./test-helpers/assert";

import {
  conflictResponse,
  formatApiErrorMessage,
  internalServerErrorResponse,
  notFoundResponse,
  parseApiErrorBody,
  unauthorizedResponse,
  validationErrorResponse,
} from "../src/lib/auth/api-error";
import { formatCollectionVisibility } from "../src/lib/labels/collection-labels";

async function main() {
  assert(
    formatApiErrorMessage(null, "fallback") === "fallback",
    "null body uses fallback",
  );

  const validation = await parseApiErrorBody(
    validationErrorResponse("Invalid request body").clone(),
  );
  assert(
    formatApiErrorMessage(validation, "fallback") === "入力内容に問題があります",
    "validation detail",
  );

  const conflict = await parseApiErrorBody(
    conflictResponse("Friend request already exists").clone(),
  );
  assert(
    formatApiErrorMessage(conflict, "fallback") === "すでに申請済みです",
    "conflict detail",
  );

  const notFound = await parseApiErrorBody(
    notFoundResponse("User not found").clone(),
  );
  assert(
    formatApiErrorMessage(notFound, "fallback") === "ユーザーが見つかりません",
    "not_found detail",
  );

  const unauthorized = await parseApiErrorBody(unauthorizedResponse().clone());
  assert(
    formatApiErrorMessage(unauthorized, "fallback") === "ログインが必要です",
    "unauthorized code",
  );

  const agentNotReady = await parseApiErrorBody(
    internalServerErrorResponse("Agent Engine is not configured").clone(),
  );
  assert(
    formatApiErrorMessage(agentNotReady, "fallback") ===
      "エージェントが準備中です。しばらくしてから再度お試しください",
    "agent engine not configured",
  );

  assert(
    formatCollectionVisibility("friends") === "友達に公開",
    "friends visibility label",
  );
  assert(
    formatCollectionVisibility("secret") === "自分だけ",
    "secret visibility label",
  );

  console.log("PASS: API error and visibility labels verified");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
