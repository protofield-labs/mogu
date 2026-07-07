"use client";

import { Plus, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  createCollection,
  listMyCollections,
  type Collection,
} from "@/lib/collections/browser-api";
import { getLastRecollectTarget } from "@/lib/recollect/last-target";
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
  const dialogRef = useRef<HTMLDialogElement>(null);
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
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

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
        const lastTarget = getLastRecollectTarget();
        const defaultId =
          lastTarget && result.some((item) => item.id === lastTarget.collectionId)
            ? lastTarget.collectionId
            : (result[0]?.id ?? null);
        setSelectedId(defaultId);
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
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[min(85dvh,640px)] w-full max-w-none rounded-t-2xl border border-border bg-mogu-surface-elevated p-0 shadow-lg backdrop:bg-black/40 sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(80dvh,640px)] sm:w-[min(100%,28rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
    >
      <div className="flex max-h-[inherit] flex-col">
        <div className="flex items-center justify-between border-b border-border px-mogu-screen-x py-3">
          <h2 className="text-sm font-semibold text-foreground">保存先を選ぶ</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="閉じる"
            onClick={onClose}
          >
            <XIcon />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-mogu-screen-x py-4">
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
                  まだコレクションがありません。最初の棚を作りましょう。
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
        </div>

        <p className="border-t border-border px-mogu-screen-x py-3 text-xs text-muted-foreground">
          長押しで保存先を選べます（保存済みの場合は保存先の確認のみ）
        </p>
      </div>
    </dialog>
  );
}
