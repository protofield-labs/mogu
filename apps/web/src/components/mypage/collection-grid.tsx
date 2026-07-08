"use client";

import { Lock, Pencil, Pin, Trash2, ChevronDown, ChevronUp } from "lucide-react";

import { MoguBrandIcon } from "@/components/brand/mogu-brand-icon";
import Link from "next/link";

import { CollectionCover } from "@/components/mypage/collection-cover";
import type { Collection } from "@/lib/collections/browser-api";
import { collectionPath } from "@/lib/share/paths";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCollectionVisibility } from "@/lib/labels/collection-labels";
import { moguEnterDelayStyle, moguEnterMotionClass } from "@/lib/ui/motion";
import { touchCardClass, touchRowClass } from "@/lib/ui/touch-feedback";
import { cn } from "@/lib/utils";

type CollectionGridProps = {
  collections: Collection[];
  onEdit?: (collection: Collection) => void;
  onDelete?: (collection: Collection) => void;
  getCollectionHref?: (collection: Collection) => string;
  showUpsell?: boolean;
  emptyMessage?: string;
  reorderMode?: boolean;
  reorderBusy?: boolean;
  onMoveUp?: (collection: Collection) => void;
  onMoveDown?: (collection: Collection) => void;
  onPinTop?: (collection: Collection) => void;
};

function CollectionTile({
  collection,
  href,
  onEdit,
  onDelete,
  reorderMode = false,
  onMoveUp,
  onMoveDown,
  onPinTop,
  disableMoveUp = false,
  disableMoveDown = false,
  reorderBusy = false,
  enterIndex,
}: {
  collection: Collection;
  href: string;
  onEdit?: (collection: Collection) => void;
  onDelete?: (collection: Collection) => void;
  reorderMode?: boolean;
  onMoveUp?: (collection: Collection) => void;
  onMoveDown?: (collection: Collection) => void;
  onPinTop?: (collection: Collection) => void;
  disableMoveUp?: boolean;
  disableMoveDown?: boolean;
  reorderBusy?: boolean;
  enterIndex?: number;
}) {
  const isSecret = collection.visibility === "secret";

  return (
    <article
      className={cn("space-y-2", enterIndex !== undefined && moguEnterMotionClass)}
      style={moguEnterDelayStyle(enterIndex)}
    >
      <Link
        href={reorderMode ? "#" : href}
        className="block"
        aria-label={collection.name}
        onClick={(event) => {
        if (reorderMode) {
          event.preventDefault();
        }
      }}
      >
        <div
          className={cn(
            "relative aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-muted to-background shadow-sm transition-shadow hover:shadow-md",
            touchCardClass,
          )}
        >
          <CollectionCover
            name={collection.name}
            coverUrl={collection.coverUrl}
            autoCoverUrls={collection.autoCoverUrls}
            className="size-full"
          />
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
      {reorderMode ? (
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={disableMoveUp || reorderBusy}
            onClick={() => onPinTop?.(collection)}
            className={cn(
              "inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-mogu-surface-elevated text-xs font-medium shadow-sm disabled:opacity-40",
              touchRowClass,
            )}
          >
            <Pin className="size-3" aria-hidden />
            先頭
          </button>
          <button
            type="button"
            disabled={disableMoveUp || reorderBusy}
            onClick={() => onMoveUp?.(collection)}
            className={cn(
              "inline-flex size-11 items-center justify-center rounded-xl bg-mogu-surface-elevated shadow-sm disabled:opacity-40",
              touchRowClass,
            )}
            aria-label="上へ"
          >
            <ChevronUp className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            disabled={disableMoveDown || reorderBusy}
            onClick={() => onMoveDown?.(collection)}
            className={cn(
              "inline-flex size-11 items-center justify-center rounded-xl bg-mogu-surface-elevated shadow-sm disabled:opacity-40",
              touchRowClass,
            )}
            aria-label="下へ"
          >
            <ChevronDown className="size-4" aria-hidden />
          </button>
        </div>
      ) : onEdit || onDelete ? (
        <div className="flex gap-1.5">
          {onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(collection)}
              className={cn(
                "inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-mogu-surface-elevated text-xs font-medium shadow-sm",
                touchRowClass,
              )}
            >
              <Pencil className="size-3" aria-hidden />
              編集
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(collection)}
              className={cn(
                "inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-mogu-surface-elevated text-xs font-medium text-destructive shadow-sm",
                touchRowClass,
              )}
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

export function CollectionGrid({
  collections,
  onEdit,
  onDelete,
  getCollectionHref = (collection) => collectionPath(collection.id),
  showUpsell = true,
  emptyMessage = "まだコレクションがありません。最初のコレクションを作ってみましょう。",
  reorderMode = false,
  reorderBusy = false,
  onMoveUp,
  onMoveDown,
  onPinTop,
}: CollectionGridProps) {
  return (
    <section className="space-y-4 px-mogu-screen-x">
      {collections.length === 0 ? (
        <EmptyState>{emptyMessage}</EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {collections.map((collection, index) => (
            <CollectionTile
              key={collection.id}
              collection={collection}
              href={getCollectionHref(collection)}
              onEdit={onEdit}
              onDelete={onDelete}
              reorderMode={reorderMode}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              onPinTop={onPinTop}
              disableMoveUp={index === 0}
              disableMoveDown={index === collections.length - 1}
              reorderBusy={reorderBusy}
              enterIndex={index}
            />
          ))}
        </div>
      )}

      {showUpsell && !reorderMode ? (
        <EmptyState className="p-5">
          <p className="inline-flex items-center justify-center gap-2 text-sm font-medium text-foreground">
            <MoguBrandIcon className="size-4" />
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
