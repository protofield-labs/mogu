/**
 * Friendship delete guard verification (#155).
 * Run via: pnpm exec tsx scripts/verify-friendship-delete.ts
 */
import { assert } from "./test-helpers/assert";

import { classifyFriendshipDeleteFailure } from "../src/lib/friendship/delete-guard";

function main() {
  assert(
    classifyFriendshipDeleteFailure(null, "uid-a", {
      status: "pending",
      mustBeRequester: true,
    }) === "not_found",
    "missing row is not_found",
  );
  assert(
    classifyFriendshipDeleteFailure(
      { status: "pending", requestedBy: "uid-b" },
      "uid-a",
      { status: "pending", mustBeRequester: true },
    ) === "forbidden",
    "non-requester cancel is forbidden",
  );
  assert(
    classifyFriendshipDeleteFailure(
      { status: "accepted", requestedBy: "uid-a" },
      "uid-a",
      { status: "pending", mustBeRequester: true },
    ) === "conflict",
    "accepted row cancel is conflict",
  );
  assert(
    classifyFriendshipDeleteFailure(
      { status: "pending", requestedBy: "uid-a" },
      "uid-a",
      { status: "pending", mustNotBeRequester: true },
    ) === "forbidden",
    "requester cannot reject own request",
  );
  assert(
    classifyFriendshipDeleteFailure(
      { status: "pending", requestedBy: "uid-b" },
      "uid-a",
      { status: "pending", mustNotBeRequester: true },
    ) === "conflict",
    "pending recipient reject race maps to conflict",
  );

  console.log("PASS: friendship delete guard");
}

main();
