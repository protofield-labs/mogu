"use client";

import { GoogleMapsAttribution } from "@/components/places/google-maps-attribution";
import { AuthImage } from "@/components/mypage/auth-image";
import { PlacePhotoImage } from "@/components/places/place-photo-image";
import { resolveSpotHeroPhoto } from "@/lib/places/resolve-spot-hero-photo";
import { cn } from "@/lib/utils";

type SpotWithPhotos = {
  photoUrls: string[];
};

type PlaceWithPhotos = {
  photos: Array<{ url: string; authorAttributions: Array<{ name: string; uri: string }> }>;
};

type SpotThumbnailPlaceholder = "icon" | "label";

type SpotThumbnailProps = {
  spot: SpotWithPhotos;
  place?: PlaceWithPhotos | null;
  alt?: string;
  className?: string;
  placeholder?: SpotThumbnailPlaceholder;
  placeholderLabel?: string;
  /** While place details load, show shimmer instead of empty placeholder. */
  placeLoading?: boolean;
  /** Overlay Google Maps attribution when showing a place photo (guardrail 7). */
  showMapsAttribution?: boolean;
};

/** Spot photo with Places proxy fallback; shared thumbnail primitive (#191). */
export function SpotThumbnail({
  spot,
  place,
  alt = "",
  className,
  placeholder = "icon",
  placeholderLabel = "店",
  placeLoading = false,
  showMapsAttribution = false,
}: SpotThumbnailProps) {
  const heroPhoto = resolveSpotHeroPhoto(spot, place);

  if (
    placeLoading &&
    spot.photoUrls.length === 0 &&
    heroPhoto === null
  ) {
    return (
      <div
        className={cn("mogu-shimmer bg-muted", className)}
        aria-busy="true"
        aria-label="写真を読み込み中"
      />
    );
  }

  if (heroPhoto?.source === "spot") {
    return (
      <AuthImage objectUrl={heroPhoto.url} alt={alt} className={className} />
    );
  }

  if (heroPhoto?.source === "place") {
    const image = (
      <PlacePhotoImage
        url={heroPhoto.url}
        alt={alt}
        className={showMapsAttribution ? "size-full" : className}
      />
    );

    if (showMapsAttribution) {
      return (
        <div className={cn("relative overflow-hidden", className)}>
          {image}
          <div className="pointer-events-none absolute inset-x-2 bottom-2 flex justify-end">
            <GoogleMapsAttribution className="rounded bg-background/80 px-1.5 py-0.5 text-[0.65rem] backdrop-blur-sm" />
          </div>
        </div>
      );
    }

    return image;
  }

  return (
    <span
      className={cn(
        "flex items-center justify-center bg-muted text-muted-foreground",
        placeholder === "label" ? "text-sm" : "text-xs",
        className,
      )}
      role={alt ? "img" : undefined}
      aria-label={alt || placeholderLabel}
    >
      {placeholderLabel}
    </span>
  );
}
