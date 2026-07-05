"use client";

import { ImagePlus } from "lucide-react";
import { useRef, useState } from "react";

import { uploadPhotoFile } from "@/lib/uploads/browser-api";

type PhotoUploadFieldProps = {
  photoUrls: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

export function PhotoUploadField({
  photoUrls,
  onChange,
  disabled = false,
}: PhotoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || photoUrls.length >= 5) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const objectUrl = await uploadPhotoFile(file);
      onChange([...photoUrls, objectUrl]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {photoUrls.map((url) => (
          <div
            key={url}
            className="flex items-center gap-2 rounded-xl border border-border bg-background px-2 py-1 text-xs text-muted-foreground"
          >
            <span className="max-w-40 truncate">写真</span>
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => onChange(photoUrls.filter((item) => item !== url))}
              className="text-destructive"
            >
              削除
            </button>
          </div>
        ))}
      </div>
      {photoUrls.length < 5 ? (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-border bg-background px-3 py-2 text-xs font-medium text-foreground disabled:opacity-50"
        >
          <ImagePlus className="size-4" aria-hidden />
          {busy ? "アップロード中…" : "写真を追加"}
        </button>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(event) => void handleFileChange(event)}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
