"use client";

import { Lock, Pencil, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";

import type { Collection } from "@/lib/collections/browser-api";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCollectionVisibility } from "@/lib/labels/collection-labels";

function collectionInitials(name: string): string {
  return name.trim().slice(0, 1) || "コ";
}

function CollectionTile({
  collection,
  href,
  onEdit,
  onDelete,
}: {
  collection: Collection;
  href: string;
  onEdit?: (collection: Collection) => void;
  onDelete?: (collection: Collection) => void;
}) {
  const isSecret = collection.visibility === "secret";

  return (
    <article className="space-y-2">
      <Link href={href} className="block">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-muted to-background shadow-sm transition-shadow hover:shadow-md">
        {collection.coverUrl ? (
          <div
            className="size-full bg-cover bg-center"
            style={{ backgroundImage: `url(${collection.coverUrl})` }}
            aria-hidden
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">
              {collectionInitials(collection.name)}
            </span>
          </div>
        )}
        {isSecret ? (
          <span className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 text-foreground shadow-sm">
            <Lock className="size-3.5" aria-label="自分だけのコレクション" />
          </span>
        ) : null}
        </div>
      </Link>
      <p className="text-center text-xs text-muted-foreground">
        {isSecret ? `${formatCollectionVisibility("secret")} ・ ` : ""}
        {collection.spotCount}軒
      </p>
      {onEdit || onDelete ? (
        <div className="flex gap-1.5">
          {onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(collection)}
              className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-xl bg-mogu-surface-elevated text-xs font-medium shadow-sm"
            >
              <Pencil className="size-3" aria-hidden />
              編集
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(collection)}
              className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-xl bg-mogu-surface-elevated text-xs font-medium text-destructive shadow-sm"
            >
              <Trash2 className="size-3" aria-hidden />
              削除
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

type CollectionGridProps = {
  collections: Collection[];
  onEdit?: (collection: Collection) => void;
  onDelete?: (collection: Collection) => void;
  getCollectionHref?: (collection: Collection) => string;
  showUpsell?: boolean;
  emptyMessage?: string;
};

export function CollectionGrid({
  collections,
  onEdit,
  onDelete,
  getCollectionHref = (collection) => `/mypage/collections/${collection.id}`,
  showUpsell = true,
  emptyMessage = "まだコレクションがありません。最初のコレクションを作ってみましょう。",
}: CollectionGridProps) {
  return (
    <section className="space-y-4 px-mogu-screen-x">
      {collections.length === 0 ? (
        <EmptyState>{emptyMessage}</EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {collections.map((collection) => (
            <CollectionTile
              key={collection.id}
              collection={collection}
              href={getCollectionHref(collection)}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {showUpsell ? (
        <EmptyState className="p-5">
          <p className="inline-flex items-center justify-center gap-2 text-sm font-medium text-foreground">
            <Sparkles className="size-4" aria-hidden />
            + このコレクションに合いそうなお店
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            スポットが増えるほど、断言が鋭くなります
          </p>
        </EmptyState>
      ) : null}
    </section>
  );
}
