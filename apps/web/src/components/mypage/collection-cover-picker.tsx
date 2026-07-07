"use client";

import { AuthImage } from "@/components/mypage/auth-image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CollectionCoverPickerProps = {
  photoUrls: string[];
  selectedUrl: string | null;
  disabled?: boolean;
  onSelect: (url: string | null) => void;
};

export function CollectionCoverPicker({
  photoUrls,
  selectedUrl,
  disabled = false,
  onSelect,
}: CollectionCoverPickerProps) {
  if (photoUrls.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        スポットに写真を追加すると、カバー画像を選べます。
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={selectedUrl === null ? "default" : "outline"}
          size="sm"
          disabled={disabled}
          onClick={() => onSelect(null)}
          className="rounded-full"
        >
          自動（最新の写真）
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {photoUrls.map((url) => {
          const selected = selectedUrl === url;
          return (
            <button
              key={url}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onSelect(url)}
              className={cn(
                "relative aspect-square overflow-hidden rounded-xl border-2 transition-colors",
                selected ? "border-primary" : "border-transparent",
              )}
            >
              <AuthImage
                objectUrl={url}
                alt=""
                className="size-full object-cover"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
