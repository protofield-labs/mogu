"use client";

import type { ReactNode } from "react";
import { Lock, Pin, ChevronDown, ChevronUp } from "lucide-react";

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
  getCollectionHref?: (collection: Collection) => string;
  emptyMessage?: string;
};

type CollectionReorderGridProps = {
  collections: Collection[];
  emptyMessage?: string;
  reorderBusy?: boolean;
  onMoveUp: (collection: Collection) => void;
  onMoveDown: (collection: Collection) => void;
  onPinTop: (collection: Collection) => void;
};

function CollectionCoverFrame({
  collection,
  enterIndex,
  children,
}: {
  collection: Collection;
  enterIndex?: number;
  children: ReactNode;
}) {
  const isSecret = collection.visibility === "secret";

  return (
    <article
      className={cn("space-y-2", enterIndex !== undefined && moguEnterMotionClass)}
      style={moguEnterDelayStyle(enterIndex)}
    >
      {children}
      <p className="text-center text-xs text-muted-foreground">
        {isSecret ? `${formatCollectionVisibility("secret")} ・ ` : ""}
        {collection.spotCount}軒
      </p>
    </article>
  );
}

function CollectionCoverCard({ collection }: { collection: Collection }) {
  const isSecret = collection.visibility === "secret";

  return (
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
  );
}

function CollectionBrowseTile({
  collection,
  href,
  enterIndex,
}: {
  collection: Collection;
  href: string;
  enterIndex?: number;
}) {
  return (
    <CollectionCoverFrame collection={collection} enterIndex={enterIndex}>
      <Link href={href} className="block" aria-label={collection.name}>
        <CollectionCoverCard collection={collection} />
      </Link>
    </CollectionCoverFrame>
  );
}

function CollectionReorderTile({
  collection,
  onMoveUp,
  onMoveDown,
  onPinTop,
  disableMoveUp = false,
  disableMoveDown = false,
  reorderBusy = false,
  enterIndex,
}: {
  collection: Collection;
  onMoveUp: (collection: Collection) => void;
  onMoveDown: (collection: Collection) => void;
  onPinTop: (collection: Collection) => void;
  disableMoveUp?: boolean;
  disableMoveDown?: boolean;
  reorderBusy?: boolean;
  enterIndex?: number;
}) {
  return (
    <CollectionCoverFrame collection={collection} enterIndex={enterIndex}>
      <div className="block" aria-label={collection.name}>
        <CollectionCoverCard collection={collection} />
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={disableMoveUp || reorderBusy}
          onClick={() => onPinTop(collection)}
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
          onClick={() => onMoveUp(collection)}
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
          onClick={() => onMoveDown(collection)}
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-xl bg-mogu-surface-elevated shadow-sm disabled:opacity-40",
            touchRowClass,
          )}
          aria-label="下へ"
        >
          <ChevronDown className="size-4" aria-hidden />
        </button>
      </div>
    </CollectionCoverFrame>
  );
}

export function CollectionGrid({
  collections,
  getCollectionHref = (collection) => collectionPath(collection.id),
  emptyMessage = "まだコレクションがありません。最初のコレクションを作ってみましょう。",
}: CollectionGridProps) {
  return (
    <section className="space-y-4 px-mogu-screen-x">
      {collections.length === 0 ? (
        <EmptyState>{emptyMessage}</EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {collections.map((collection, index) => (
            <CollectionBrowseTile
              key={collection.id}
              collection={collection}
              href={getCollectionHref(collection)}
              enterIndex={index}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function CollectionReorderGrid({
  collections,
  emptyMessage = "まだコレクションがありません。最初のコレクションを作ってみましょう。",
  reorderBusy = false,
  onMoveUp,
  onMoveDown,
  onPinTop,
}: CollectionReorderGridProps) {
  return (
    <section className="space-y-4 px-mogu-screen-x">
      {collections.length === 0 ? (
        <EmptyState>{emptyMessage}</EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {collections.map((collection, index) => (
            <CollectionReorderTile
              key={collection.id}
              collection={collection}
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
    </section>
  );
}
