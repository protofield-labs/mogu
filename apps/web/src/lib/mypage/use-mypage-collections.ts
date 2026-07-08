"use client";

import { useState, type FormEvent } from "react";

import {
  createCollection,
  reorderMyCollections,
  type Collection,
} from "@/lib/collections/browser-api";
import {
  emptyCollectionForm,
  type CollectionForm,
} from "@/components/mypage/collection-form-fields";
import type { MeProfile } from "@/lib/mypage/types";

type UseMypageCollectionsOptions = {
  initialCollections: Collection[];
  updateMe: (
    patch:
      | Partial<MeProfile>
      | ((current: MeProfile | null) => MeProfile | null),
  ) => void;
};

export function useMypageCollections({
  initialCollections,
  updateMe,
}: UseMypageCollectionsOptions) {
  const [collections, setCollections] = useState(initialCollections);
  const [createForm, setCreateForm] = useState<CollectionForm>(emptyCollectionForm);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState(false);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setCreateError(null);
    try {
      const collection = await createCollection({
        name: createForm.name.trim(),
        visibility: createForm.visibility,
        ...(createForm.description.trim()
          ? { description: createForm.description }
          : {}),
        ...(createForm.theme.trim() ? { theme: createForm.theme } : {}),
      });
      setCollections((current) => [...current, collection]);
      setCreateForm(emptyCollectionForm);
      setShowCreateForm(false);
      updateMe((current) =>
        current
          ? {
              ...current,
              counts: {
                ...current.counts,
                collections: current.counts.collections + 1,
              },
            }
          : current,
      );
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "作成に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function persistCollectionOrder(nextCollections: Collection[]) {
    if (busy) {
      return;
    }
    setBusy(true);
    setCollectionError(null);
    try {
      const reordered = await reorderMyCollections(
        nextCollections.map((collection) => collection.id),
      );
      setCollections(reordered);
    } catch (err) {
      setCollectionError(err instanceof Error ? err.message : "並べ替えに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  function moveCollection(collection: Collection, direction: "up" | "down") {
    if (busy) {
      return;
    }
    const index = collections.findIndex((item) => item.id === collection.id);
    if (index < 0) {
      return;
    }
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= collections.length) {
      return;
    }
    const next = [...collections];
    const [removed] = next.splice(index, 1);
    next.splice(targetIndex, 0, removed!);
    void persistCollectionOrder(next);
  }

  function pinCollectionToTop(collection: Collection) {
    if (busy) {
      return;
    }
    const next = [
      collection,
      ...collections.filter((item) => item.id !== collection.id),
    ];
    void persistCollectionOrder(next);
  }

  return {
    collections,
    setCollections,
    createForm,
    setCreateForm,
    showCreateForm,
    setShowCreateForm,
    busy,
    createError,
    collectionError,
    reorderMode,
    setReorderMode,
    handleCreate,
    moveCollection,
    pinCollectionToTop,
  };
}
