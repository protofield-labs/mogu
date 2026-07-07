"use client";

import { PlacePhotoImage } from "@/components/places/place-photo-image";
import { AuthImage } from "@/components/mypage/auth-image";
import type { PlaceDTO } from "@/lib/places/types";
import { resolveSpotHeroPhoto } from "@/lib/places/resolve-spot-hero-photo";

type SpotDetailMediaProps = {
  photoUrls: string[];
  place: PlaceDTO | null;
  placeName: string | null;
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
}: SpotDetailMediaProps) {
  const heroPhoto = resolveSpotHeroPhoto({ photoUrls }, place);

  if (photoUrls.length > 0) {
    return (
      <div className="mb-4 flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {photoUrls.map((url) => (
          <AuthImage
            key={url}
            objectUrl={url}
            alt={placeName ?? ""}
            className="aspect-[4/3] w-full shrink-0 snap-center rounded-xl object-cover"
          />
        ))}
      </div>
    );
  }

  if (!place || place.photos.length === 0) {
    return null;
  }

  const attribution = formatPhotoAttributions(
    heroPhoto?.source === "place" ? heroPhoto.authorAttributions : [],
  );

  return (
    <div className="mb-4 space-y-2">
      <div className="flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {place.photos.map((photo) => (
          <PlacePhotoImage
            key={photo.url}
            url={photo.url}
            alt={placeName ?? ""}
            className="aspect-[4/3] w-full shrink-0 snap-center rounded-xl object-cover"
          />
        ))}
      </div>
      {attribution ? (
        <p className="text-caption text-muted-foreground">Photo: {attribution}</p>
      ) : null}
    </div>
  );
}
