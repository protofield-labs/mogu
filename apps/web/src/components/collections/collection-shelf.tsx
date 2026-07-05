"use client";

import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { parseApiErrorBody } from "@/lib/auth/api-error";
import { authFetch } from "@/lib/auth/auth-fetch";
import {
  createCollection,
  deleteCollection,
  listMyCollections,
  updateCollection,
  type Collection,
  type CollectionVisibility,
} from "@/lib/collections/browser-api";
import { cn } from "@/lib/utils";

type Me = {
  displayName: string;
  avatarColor: string;
  counts: {
    collections: number;
    spots: number;
    friends: number;
  };
};

type FormState = {
  name: string;
  description: string;
  visibility: CollectionVisibility;
  theme: string;
};

const emptyForm: FormState = {
  name: "",
  description: "",
  visibility: "friends",
  theme: "",
};

async function loadMe(): Promise<Me> {
  const response = await authFetch("/api/v1/users/me");
  if (!response.ok) {
    const body = await parseApiErrorBody(response);
    throw new Error(body?.error.message ?? "プロフィールを読み込めませんでした");
  }
  const data = (await response.json()) as { user?: Me } | Me;
  return "user" in data && data.user ? data.user : (data as Me);
}

function toCreateInput(form: FormState) {
  return {
    name: form.name,
    visibility: form.visibility,
    ...(form.description.trim() ? { description: form.description } : {}),
    ...(form.theme.trim() ? { theme: form.theme } : {}),
  };
}

function toUpdateInput(form: FormState) {
  return {
    name: form.name,
    description: form.description.trim() ? form.description : null,
    visibility: form.visibility,
    theme: form.theme.trim() ? form.theme : null,
  };
}

function collectionInitials(name: string): string {
  return name.trim().slice(0, 2) || "棚";
}

function CollectionCard({
  collection,
  editing,
  editForm,
  onStartEdit,
  onCancelEdit,
  onChangeEdit,
  onSaveEdit,
  onDelete,
  busy,
}: {
  collection: Collection;
  editing: boolean;
  editForm: FormState;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onChangeEdit: (next: FormState) => void;
  onSaveEdit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  if (editing) {
    return (
      <form
        className="space-y-3 rounded-3xl border border-border bg-mogu-surface-elevated p-4"
        onSubmit={onSaveEdit}
      >
        <CollectionFields form={editForm} onChange={onChangeEdit} compact />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="h-9 flex-1 rounded-2xl bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            保存
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancelEdit}
            className="h-9 flex-1 rounded-2xl border border-border bg-background px-3 text-sm font-medium"
          >
            キャンセル
          </button>
        </div>
      </form>
    );
  }

  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-mogu-surface-elevated shadow-sm">
      <div className="relative flex aspect-square items-center justify-center bg-gradient-to-br from-muted to-background">
        {collection.coverUrl ? (
          <div
            className="size-full bg-cover bg-center"
            style={{ backgroundImage: `url(${collection.coverUrl})` }}
            aria-hidden
          />
        ) : (
          <div className="text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-primary text-xl font-semibold text-primary-foreground">
              {collectionInitials(collection.name)}
            </div>
            {collection.theme ? (
              <p className="mt-3 text-xs font-medium text-muted-foreground">
                {collection.theme}
              </p>
            ) : null}
          </div>
        )}
        {collection.visibility === "secret" ? (
          <span className="absolute right-3 top-3 rounded-full bg-background/90 p-2 text-foreground shadow-sm">
            <Lock className="size-4" aria-label="secret コレクション" />
          </span>
        ) : null}
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h2 className="line-clamp-1 text-base font-semibold text-foreground">
            {collection.name}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {collection.spotCount} スポット ・{" "}
            {collection.visibility === "secret" ? "secret" : "friends"}
          </p>
          {collection.description ? (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {collection.description}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onStartEdit}
            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-border bg-background px-2 text-xs font-medium"
          >
            <Pencil className="size-3.5" aria-hidden />
            編集
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-border bg-background px-2 text-xs font-medium text-destructive"
          >
            <Trash2 className="size-3.5" aria-hidden />
            削除
          </button>
        </div>
      </div>
    </article>
  );
}

function CollectionFields({
  form,
  onChange,
  compact = false,
}: {
  form: FormState;
  onChange: (next: FormState) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("space-y-3", compact ? "text-sm" : undefined)}>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-foreground">名前</span>
        <input
          type="text"
          required
          maxLength={80}
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          className="h-10 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder="週末に行きたい店"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-foreground">説明</span>
        <textarea
          maxLength={240}
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          className="min-h-20 w-full resize-none rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder="どんな棚かメモ"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">公開範囲</span>
          <select
            value={form.visibility}
            onChange={(e) =>
              onChange({
                ...form,
                visibility: e.target.value as CollectionVisibility,
              })
            }
            className="h-10 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="friends">friends</option>
            <option value="secret">secret</option>
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">テーマ</span>
          <input
            type="text"
            maxLength={80}
            value={form.theme}
            onChange={(e) => onChange({ ...form, theme: e.target.value })}
            className="h-10 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder="デート"
          />
        </label>
      </div>
    </div>
  );
}

export function CollectionShelf() {
  const [me, setMe] = useState<Me | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shelfError, setShelfError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      try {
        const [profile, nextCollections] = await Promise.all([
          loadMe(),
          listMyCollections(),
        ]);
        if (!cancelled) {
          setMe(profile);
          setCollections(nextCollections);
        }
      } catch (err) {
        if (!cancelled) {
          setShelfError(
            err instanceof Error ? err.message : "読み込みに失敗しました",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialData();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const collection = await createCollection(toCreateInput(form));
      setCollections((current) => [collection, ...current]);
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(collection: Collection) {
    setEditingId(collection.id);
    setEditForm({
      name: collection.name,
      description: collection.description ?? "",
      visibility: collection.visibility,
      theme: collection.theme ?? "",
    });
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) {
      return;
    }

    setBusy(true);
    setShelfError(null);
    try {
      const collection = await updateCollection(editingId, toUpdateInput(editForm));
      setCollections((current) =>
        current.map((item) => (item.id === collection.id ? collection : item)),
      );
      setEditingId(null);
    } catch (err) {
      setShelfError(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(collection: Collection) {
    if (!window.confirm(`「${collection.name}」を削除しますか？`)) {
      return;
    }

    setBusy(true);
    setShelfError(null);
    try {
      await deleteCollection(collection.id);
      setCollections((current) =>
        current.filter((item) => item.id !== collection.id),
      );
    } catch (err) {
      setShelfError(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        マイページを読み込んでいます…
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-mogu-screen-x py-mogu-screen-y">
      <header className="rounded-3xl border border-border bg-mogu-surface-elevated p-5">
        <div className="flex items-center gap-3">
          <div
            className="flex size-14 items-center justify-center rounded-full text-lg font-semibold text-white"
            style={{ backgroundColor: me?.avatarColor }}
          >
            {me?.displayName.slice(0, 1) ?? "?"}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {me?.displayName}
            </h1>
            <p className="text-sm text-muted-foreground">マイページ</p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-3 rounded-2xl bg-background p-3 text-center">
          <div>
            <dt className="text-xs text-muted-foreground">コレクション</dt>
            <dd className="mt-1 font-semibold text-foreground">
              {collections.length}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">スポット</dt>
            <dd className="mt-1 font-semibold text-foreground">
              {me?.counts.spots ?? 0}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">友達</dt>
            <dd className="mt-1 font-semibold text-foreground">
              {me?.counts.friends ?? 0}
            </dd>
          </div>
        </dl>
      </header>

      <form
        className="space-y-4 rounded-3xl border border-border bg-mogu-surface-elevated p-5"
        onSubmit={(e) => void handleCreate(e)}
      >
        <div className="flex items-center gap-2">
          <Plus className="size-5 text-foreground" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">
            コレクションを作成
          </h2>
        </div>
        <CollectionFields form={form} onChange={setForm} />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="h-10 w-full rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
        >
          作成する
        </button>
      </form>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            コレクション棚
          </h2>
          <span className="text-xs text-muted-foreground">
            {collections.length} 件
          </span>
        </div>
        {shelfError ? (
          <p className="text-sm text-destructive">{shelfError}</p>
        ) : null}
        {collections.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-mogu-surface-elevated p-8 text-center text-sm text-muted-foreground">
            まだコレクションがありません。最初の棚を作ってみましょう。
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {collections.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                editing={editingId === collection.id}
                editForm={editForm}
                onStartEdit={() => startEdit(collection)}
                onCancelEdit={() => setEditingId(null)}
                onChangeEdit={setEditForm}
                onSaveEdit={(event) => void handleSaveEdit(event)}
                onDelete={() => void handleDelete(collection)}
                busy={busy}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
