"use client";

import { useRef, useState, type FormEvent } from "react";

import {
  createCollection,
  deleteCollection,
  getCollectionDetail,
  reorderMyCollections,
  updateCollection,
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
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [editForm, setEditForm] = useState<CollectionForm>(emptyCollectionForm);
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);
  const [editCoverUrl, setEditCoverUrl] = useState<string | null>(null);
  const [editPhotoUrls, setEditPhotoUrls] = useState<string[]>([]);
  const [loadingEditPhotos, setLoadingEditPhotos] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const editPhotosRequestRef = useRef(0);

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

  function startEdit(collection: Collection) {
    const requestId = ++editPhotosRequestRef.current;
    setEditingCollection(collection);
    setEditForm({
      name: collection.name,
      description: collection.description ?? "",
      visibility: collection.visibility,
      theme: collection.theme ?? "",
    });
    setEditCoverUrl(collection.coverUrl);
    setEditPhotoUrls([]);
    setLoadingEditPhotos(true);
    void getCollectionDetail(collection.id)
      .then((detail) => {
        if (editPhotosRequestRef.current !== requestId) {
          return;
        }
        const urls = detail.spots.flatMap((spot) => spot.photoUrls);
        setEditPhotoUrls([...new Set(urls)]);
      })
      .catch(() => {
        if (editPhotosRequestRef.current !== requestId) {
          return;
        }
        setEditPhotoUrls([]);
      })
      .finally(() => {
        if (editPhotosRequestRef.current !== requestId) {
          return;
        }
        setLoadingEditPhotos(false);
      });
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

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCollection) {
      return;
    }

    setBusy(true);
    setCollectionError(null);
    try {
      const collection = await updateCollection(editingCollection.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() ? editForm.description : null,
        visibility: editForm.visibility,
        theme: editForm.theme.trim() ? editForm.theme : null,
        coverUrl: editCoverUrl,
      });
      setCollections((current) =>
        current.map((item) => (item.id === collection.id ? collection : item)),
      );
      setEditingCollection(null);
    } catch (err) {
      setCollectionError(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmDeleteCollection() {
    if (!deleteTarget) {
      return;
    }

    const collection = deleteTarget;
    setBusy(true);
    setCollectionError(null);
    try {
      await deleteCollection(collection.id);
      setCollections((current) =>
        current.filter((item) => item.id !== collection.id),
      );
      updateMe((current) =>
        current
          ? {
              ...current,
              counts: {
                ...current.counts,
                collections: Math.max(0, current.counts.collections - 1),
              },
            }
          : current,
      );
      setDeleteTarget(null);
    } catch (err) {
      setCollectionError(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return {
    collections,
    setCollections,
    createForm,
    setCreateForm,
    showCreateForm,
    setShowCreateForm,
    editingCollection,
    setEditingCollection,
    editForm,
    setEditForm,
    busy,
    createError,
    collectionError,
    deleteTarget,
    setDeleteTarget,
    editCoverUrl,
    setEditCoverUrl,
    editPhotoUrls,
    loadingEditPhotos,
    reorderMode,
    setReorderMode,
    handleCreate,
    startEdit,
    moveCollection,
    pinCollectionToTop,
    handleSaveEdit,
    handleConfirmDeleteCollection,
  };
}
