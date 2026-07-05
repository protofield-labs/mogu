"use client";

import { Lock, Sparkles } from "lucide-react";

import type { Collection } from "@/lib/collections/browser-api";
import { cn } from "@/lib/utils";

function collectionInitials(name: string): string {
  return name.trim().slice(0, 1) || "棚";
}

function CollectionTile({ collection }: { collection: Collection }) {
  const isSecret = collection.visibility === "secret";

  return (
    <article className="space-y-2">
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-muted to-background">
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
            <Lock className="size-3.5" aria-label="secret コレクション" />
          </span>
        ) : null}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {isSecret ? "secret ・ " : ""}
        {collection.spotCount}軒
      </p>
    </article>
  );
}

type CollectionGridProps = {
  collections: Collection[];
};

export function CollectionGrid({ collections }: CollectionGridProps) {
  return (
    <section className="space-y-4 px-mogu-screen-x">
      <h2 className="text-sm font-semibold text-foreground">あなたのコレクション</h2>
      {collections.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-mogu-surface-elevated p-8 text-center text-sm text-muted-foreground">
          まだコレクションがありません。最初の棚を作ってみましょう。
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {collections.map((collection) => (
            <CollectionTile key={collection.id} collection={collection} />
          ))}
        </div>
      )}

      <div
        className={cn(
          "rounded-3xl border border-dashed border-border bg-mogu-surface-elevated p-5 text-center",
        )}
      >
        <p className="inline-flex items-center justify-center gap-2 text-sm font-medium text-foreground">
          <Sparkles className="size-4" aria-hidden />
          + この棚に合いそうなお店
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          スポットが増えるほど、断言が鋭くなります
        </p>
      </div>
    </section>
  );
}
