"use client";

import { PlacePhotoImage } from "@/components/places/place-photo-image";
import { AuthImage } from "@/components/mypage/auth-image";
import type { PlaceDTO } from "@/lib/places/types";
import { cn } from "@/lib/utils";

type SpotDetailMediaProps = {
  photoUrls: string[];
  place: PlaceDTO | null;
  placeName: string | null;
  /** Full-bleed hero for bottom sheets (#210). */
  variant?: "inline" | "hero";
};

function formatPhotoAttributions(
  attributions: Array<{ name: string; uri: string }>,
): string | null {
  const names = attributions.map((attr) => attr.name).filter(Boolean);
  return names.length > 0 ? names.join(", ") : null;
}

export function SpotDetailMedia({
  photoUrls,
  place,
  placeName,
  variant = "inline",
}: SpotDetailMediaProps) {
  const hero = variant === "hero";
  const imageClassName = cn(
    "w-full object-cover",
    hero ? "aspect-[4/3] max-h-72" : "aspect-[4/3] shrink-0 snap-center rounded-xl",
  );
  const scrollClassName = cn(
    "flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
    hero ? "w-full" : "mb-4",
  );

  if (photoUrls.length > 0) {
    return (
      <div className={scrollClassName}>
        {photoUrls.map((url) => (
          <AuthImage
            key={url}
            objectUrl={url}
            alt={placeName ?? ""}
            className={imageClassName}
          />
        ))}
      </div>
    );
  }

  if (!place || place.photos.length === 0) {
    if (hero) {
      return (
        <div
          className="flex aspect-[4/3] max-h-72 w-full items-center justify-center bg-muted"
          aria-hidden
        >
          <span className="text-sm text-muted-foreground">写真なし</span>
        </div>
      );
    }
    return null;
  }

  return (
    <div className={scrollClassName}>
      {place.photos.map((photo) => {
        const attribution = formatPhotoAttributions(photo.authorAttributions);
        return (
          <div
            key={photo.url}
            className={cn("w-full shrink-0 snap-center", !hero && "space-y-2")}
          >
            <PlacePhotoImage
              url={photo.url}
              alt={placeName ?? ""}
              className={imageClassName}
            />
            {!hero && attribution ? (
              <p className="text-caption text-muted-foreground">
                Photo: {attribution}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
