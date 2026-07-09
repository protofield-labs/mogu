"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { AuthImage } from "@/components/mypage/auth-image";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { uploadPhotoFile } from "@/lib/uploads/browser-api";

type AvatarPhotoFieldProps = {
  displayName: string;
  avatarColor: string;
  avatarUrl: string | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
};

export function AvatarPhotoField({
  displayName,
  avatarColor,
  avatarUrl,
  onChange,
  disabled = false,
}: AvatarPhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const objectUrl = await uploadPhotoFile(file);
      onChange(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">プロフィール写真</p>
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <span className="relative size-16 overflow-hidden rounded-full ring-1 ring-mogu-avatar-ring-idle">
            <AuthImage
              objectUrl={avatarUrl}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          </span>
        ) : (
          <Avatar
            displayName={displayName}
            avatarColor={avatarColor}
            size="lg"
          />
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="size-4" aria-hidden />
            {busy ? "アップロード中…" : avatarUrl ? "写真を変更" : "写真を追加"}
          </Button>
          {avatarUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || busy}
              onClick={() => onChange(null)}
              className="text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
              削除
            </Button>
          ) : null}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(event) => void handleFileChange(event)}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">
        写真未設定のときは下のアバター色とイニシャルが表示されます。
      </p>
    </div>
  );
}
