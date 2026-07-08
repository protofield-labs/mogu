"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetBody, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import {
  createCollection,
  listMyCollections,
  type Collection,
} from "@/lib/collections/browser-api";
import { pickDefaultCollection } from "@/lib/recollect/recollect-to-default-collection";
import { saveSpotToCollection } from "@/lib/recollect/save-spot";
import { cn } from "@/lib/utils";

type CollectionPickerSheetProps = {
  open: boolean;
  spotId: string;
  busy?: boolean;
  onClose: () => void;
  onSaved: (collectionId: string, collectionName: string) => void;
};

export function CollectionPickerSheet({
  open,
  spotId,
  busy = false,
  onClose,
  onSaved,
}: CollectionPickerSheetProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      setSaveError(null);
      setShowCreateForm(false);
      setNewName("");

      try {
        const result = await listMyCollections();
        if (cancelled) {
          return;
        }
        setCollections(result);
        setSelectedId(pickDefaultCollection(result)?.id ?? null);
        if (result.length === 0) {
          setShowCreateForm(true);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "コレクションを読み込めませんでした",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, spotId]);

  async function handleSelectCollection(collection: Collection) {
    if (saving || busy) {
      return;
    }
    setSelectedId(collection.id);
    setSaving(true);
    setSaveError(null);
    const result = await saveSpotToCollection(spotId, collection.id, collection.name);
    setSaving(false);
    if (result.ok) {
      onSaved(collection.id, collection.name);
    } else {
      setSaveError(result.error);
    }
  }

  async function handleCreateCollection() {
    const name = newName.trim();
    if (!name || creating || saving || busy) {
      return;
    }

    setCreating(true);
    setSaveError(null);
    try {
      const created = await createCollection({
        name,
        visibility: "friends",
      });
      setCollections((current) => [created, ...current]);
      setShowCreateForm(false);
      setNewName("");
      await handleSelectCollection(created);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "コレクションを作成できませんでした",
      );
    } finally {
      setCreating(false);
    }
  }

  const disabled = saving || creating || busy;

  return (
    <Sheet open={open} onClose={onClose} ariaLabel="保存先を選ぶ" className="max-h-[min(85dvh,640px)] sm:max-h-[min(80dvh,640px)]">
      <SheetHeader>
        <SheetTitle>保存先を選ぶ</SheetTitle>
      </SheetHeader>

      <SheetBody>
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : (
          <>
            {collections.length > 0 ? (
              <ul className="space-y-2">
                {collections.map((collection) => (
                  <li key={collection.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => void handleSelectCollection(collection)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors",
                        selectedId === collection.id
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:bg-muted/40",
                      )}
                    >
                      <span className="text-sm font-medium text-foreground">
                        {collection.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {collection.spotCount}軒
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                まだコレクションがありません。最初のコレクションを作りましょう。
              </p>
            )}

            <div className="mt-4 border-t border-border pt-4">
              {showCreateForm ? (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    新しいコレクション
                  </p>
                  <Input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="例: 行きたいところ"
                    disabled={disabled}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                    disabled={disabled || newName.trim().length === 0}
                    onClick={() => void handleCreateCollection()}
                  >
                    {creating ? (
                      <>
                        <Spinner />
                        作成中…
                      </>
                    ) : (
                      "作成して保存"
                    )}
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={disabled}
                  onClick={() => setShowCreateForm(true)}
                >
                  <Plus className="size-4" aria-hidden />
                  新しいコレクション
                </Button>
              )}
            </div>
          </>
        )}

        {saveError ? (
          <p className="mt-3 text-xs text-destructive" role="alert">
            {saveError}
          </p>
        ) : null}
      </SheetBody>

      <SheetFooter className="text-xs text-muted-foreground">
        長押しで保存先を選べます（保存済みの場合は保存先の確認のみ）
      </SheetFooter>
    </Sheet>
  );
}
