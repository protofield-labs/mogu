/**
 * Collection card actions verification (#230 Definition of Done).
 * Grid tiles are browse-only; edit/delete live in the detail action sheet.
 * Run via: pnpm exec tsx scripts/verify-collection-actions.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const collectionGrid = readSource("components/mypage/collection-grid.tsx");
assert(!collectionGrid.includes("onEdit"), "grid no longer exposes edit action");
assert(!collectionGrid.includes("onDelete"), "grid no longer exposes delete action");
assert(!collectionGrid.includes("Trash2"), "grid has no always-visible delete button");
assert(collectionGrid.includes("onPinTop"), "grid keeps reorder pin-to-top");
assert(collectionGrid.includes('aria-label="上へ"'), "grid keeps move-up control");
assert(collectionGrid.includes('aria-label="下へ"'), "grid keeps move-down control");

const detailView = readSource("components/mypage/collection-detail-view.tsx");
assert(
  detailView.includes('aria-label="コレクションの操作"'),
  "detail header exposes overflow action button",
);
assert(detailView.includes("MoreHorizontal"), "overflow button uses kebab icon");
assert(detailView.includes("コレクションを編集"), "action sheet offers edit");
assert(detailView.includes("コレクションを削除"), "action sheet offers delete");
assert(detailView.includes("CollectionFormFields"), "edit sheet reuses collection form fields");
assert(detailView.includes("deleteCollection"), "detail wires collection delete");
assert(
  detailView.includes('router.replace("/mypage")'),
  "delete replaces history so back skips the deleted collection",
);
assert(detailView.includes("updateMe"), "delete updates profile counts");
assert(detailView.includes("refreshMe"), "delete refreshes profile counts from server");
assert(
  detailView.includes("errorMessage={deleteCollectionError}"),
  "delete failure surfaces inside the confirm dialog",
);

const mypageView = readSource("components/mypage/mypage-view.tsx");
assert(!mypageView.includes("editingCollection"), "mypage inline edit form removed");
assert(!mypageView.includes("ConfirmDialog"), "mypage collection delete dialog removed");
assert(mypageView.includes("reorderMode"), "mypage keeps reorder mode toggle");

const collectionsHook = readSource("lib/mypage/use-mypage-collections.ts");
assert(!collectionsHook.includes("startEdit"), "hook no longer manages inline edit");
assert(
  !collectionsHook.includes("handleConfirmDeleteCollection"),
  "hook no longer manages collection delete",
);
assert(collectionsHook.includes("persistCollectionOrder"), "hook keeps reorder logic");

console.log("PASS: collection card actions verified");
