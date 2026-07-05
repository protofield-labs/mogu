"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { AuthImage } from "@/components/mypage/auth-image";
import { PhotoUploadField } from "@/components/mypage/photo-upload-field";
import { searchPlaces, type PlaceSearchResult } from "@/lib/places/browser-api";
import {
  createSpot,
  deleteSpot,
  updateSpot,
  type Spot,
  type SpotRating,
} from "@/lib/spots/browser-api";

type SpotFormState = {
  placeId: string;
  placeName: string;
  comment: string;
  rating: SpotRating;
  tagArea: string;
  tagGenre: string;
  tagSituation: string;
  freeTags: string;
  photoUrls: string[];
};

const emptyForm: SpotFormState = {
  placeId: "",
  placeName: "",
  comment: "",
  rating: "again",
  tagArea: "",
  tagGenre: "",
  tagSituation: "",
  freeTags: "",
  photoUrls: [],
};

const ratingOptions: { value: SpotRating; label: string }[] = [
  { value: "again", label: "また行きたい" },
  { value: "either", label: "どちらでも" },
  { value: "no", label: "行かない" },
];

function spotToForm(spot: Spot): SpotFormState {
  return {
    placeId: spot.placeId,
    placeName: spot.comment || spot.placeId,
    comment: spot.comment,
    rating: spot.rating,
    tagArea: spot.structuredTags.area ?? "",
    tagGenre: spot.structuredTags.genre ?? "",
    tagSituation: spot.structuredTags.situation ?? "",
    freeTags: spot.freeTags.join(", "),
    photoUrls: spot.photoUrls,
  };
}

type SpotFormProps = {
  collectionId: string;
  editingSpot?: Spot | null;
  onSaved: (spot: Spot) => void;
  onCancelEdit?: () => void;
};

export function SpotForm({
  collectionId,
  editingSpot,
  onSaved,
  onCancelEdit,
}: SpotFormProps) {
  const [form, setForm] = useState<SpotFormState>(
    editingSpot ? spotToForm(editingSpot) : emptyForm,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length === 0 || editingSpot) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchPlaces(query)
        .then((results) => {
          if (!cancelled) {
            setSearchResults(results);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "検索に失敗しました");
          }
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery, editingSpot]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingSpot && !form.placeId) {
      setError("店舗を選択してください");
      return;
    }

    setBusy(true);
    setError(null);
    const freeTags = form.freeTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const structuredTags = {
      area: form.tagArea.trim() || null,
      genre: form.tagGenre.trim() || null,
      situation: form.tagSituation.trim() || null,
    };

    try {
      const spot = editingSpot
        ? await updateSpot(editingSpot.id, {
            comment: form.comment.trim(),
            rating: form.rating,
            structuredTags,
            freeTags,
            photoUrls: form.photoUrls,
          })
        : await createSpot(collectionId, {
            placeId: form.placeId,
            comment: form.comment.trim(),
            rating: form.rating,
            structuredTags,
            freeTags,
            photoUrls: form.photoUrls,
          });
      onSaved(spot);
      if (!editingSpot) {
        setForm(emptyForm);
        setSearchQuery("");
        setSearchResults([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="space-y-4 rounded-3xl border border-border bg-mogu-surface-elevated p-4"
    >
      <h2 className="text-sm font-semibold text-foreground">
        {editingSpot ? "スポットを編集" : "スポットを追加"}
      </h2>

      {!editingSpot ? (
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">店舗検索</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="店名で検索"
            className="h-10 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
      ) : null}

      {!editingSpot && searchResults.length > 0 ? (
        <ul className="space-y-2">
          {searchResults.map((place) => (
            <li key={place.placeId}>
              <button
                type="button"
                onClick={() => {
                  setForm((current) => ({
                    ...current,
                    placeId: place.placeId,
                    placeName: place.name,
                  }));
                  setSearchResults([]);
                  setSearchQuery(place.name);
                }}
                className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-left text-sm"
              >
                <span className="font-medium text-foreground">{place.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {place.address}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {form.placeId ? (
        <p className="text-xs text-muted-foreground">
          選択中: {form.placeName || form.placeId}
        </p>
      ) : null}

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-foreground">一言</span>
        <textarea
          value={form.comment}
          onChange={(event) =>
            setForm((current) => ({ ...current, comment: event.target.value }))
          }
          maxLength={500}
          className="min-h-20 w-full resize-none rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder="この店の感想"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">評価</legend>
        <div className="flex flex-wrap gap-2">
          {ratingOptions.map((option) => (
            <label
              key={option.value}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs"
            >
              <input
                type="radio"
                name="rating"
                value={option.value}
                checked={form.rating === option.value}
                onChange={() =>
                  setForm((current) => ({ ...current, rating: option.value }))
                }
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["tagArea", "エリア"],
            ["tagGenre", "ジャンル"],
            ["tagSituation", "シーン"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            <input
              type="text"
              maxLength={80}
              value={form[key]}
              onChange={(event) =>
                setForm((current) => ({ ...current, [key]: event.target.value }))
              }
              className="h-9 w-full rounded-xl border border-border bg-background px-2 text-xs outline-none"
            />
          </label>
        ))}
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-foreground">自由タグ</span>
        <input
          type="text"
          value={form.freeTags}
          onChange={(event) =>
            setForm((current) => ({ ...current, freeTags: event.target.value }))
          }
          placeholder="カンマ区切り"
          className="h-10 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none"
        />
      </label>

      <PhotoUploadField
        photoUrls={form.photoUrls}
        onChange={(photoUrls) => setForm((current) => ({ ...current, photoUrls }))}
        disabled={busy}
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="h-10 flex-1 rounded-2xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {editingSpot ? "保存" : "追加する"}
        </button>
        {editingSpot && onCancelEdit ? (
          <button
            type="button"
            disabled={busy}
            onClick={onCancelEdit}
            className="h-10 flex-1 rounded-2xl border border-border bg-background text-sm font-medium"
          >
            キャンセル
          </button>
        ) : null}
      </div>
    </form>
  );
}

type SpotListProps = {
  spots: Spot[];
  onEdit: (spot: Spot) => void;
  onDelete: (spot: Spot) => void;
};

export function SpotList({ spots, onEdit, onDelete }: SpotListProps) {
  if (spots.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        まだスポットがありません。
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {spots.map((spot) => (
        <li
          key={spot.id}
          className="rounded-2xl border border-border bg-mogu-surface-elevated p-4"
        >
          <div className="flex gap-3">
            {spot.photoUrls[0] ? (
              <AuthImage
                objectUrl={spot.photoUrls[0]}
                alt=""
                className="size-16 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div className="size-16 shrink-0 rounded-xl bg-muted" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {spot.comment || spot.placeId}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {spot.rating} ・ 輪{spot.savedCount}人
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => onEdit(spot)}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-xl border border-border bg-background text-xs font-medium"
            >
              <Pencil className="size-3.5" aria-hidden />
              編集
            </button>
            <button
              type="button"
              onClick={() => onDelete(spot)}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-xl border border-border bg-background text-xs font-medium text-destructive"
            >
              <Trash2 className="size-3.5" aria-hidden />
              削除
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
