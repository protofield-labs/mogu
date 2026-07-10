"use client";

import { createContext, use, useId, type ReactNode } from "react";
import type { VariantProps } from "class-variance-authority";

import { RecollectPicker } from "@/components/recollect/recollect-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { googleMapsPlaceUrl } from "@/lib/places/maps-links";
import type { PlaceDTO } from "@/lib/places/types";
import { saveButtonA11yProps } from "@/lib/recollect/save-button-a11y";
import type { useRecollect } from "@/lib/recollect/use-recollect";
import { cn } from "@/lib/utils";

type SpotSaveFooterContextValue = {
  spotId: string;
  recollect: ReturnType<typeof useRecollect>;
};

const SpotSaveFooterContext = createContext<SpotSaveFooterContextValue | null>(
  null,
);

function useSpotSaveFooterContext(): SpotSaveFooterContextValue {
  const context = use(SpotSaveFooterContext);
  if (!context) {
    throw new Error("SpotSaveFooter subcomponents must be used within SpotSaveFooter");
  }
  return context;
}

type SpotSaveFooterProps = {
  spotId: string;
  recollect: ReturnType<typeof useRecollect>;
  children: ReactNode;
};

/**
 * Shared save-footer layer (#292): provider for the save toggle button,
 * error message, and collection picker that were copy-pasted across
 * spot cards and detail sheets. Layout stays at each call site;
 * subcomponents read state from this context.
 */
function SpotSaveFooterRoot({ spotId, recollect, children }: SpotSaveFooterProps) {
  return (
    <SpotSaveFooterContext value={{ spotId, recollect }}>
      {children}
    </SpotSaveFooterContext>
  );
}

type SaveButtonProps = {
  /** Label shown while the spot is not saved yet (default: 保存する). */
  label?: string;
  icon?: ReactNode;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
};

/** Save/unsave toggle: tap toggles, long press / Shift+Enter opens the picker. */
function SpotSaveButton({ label = "保存する", icon, variant, size, className }: SaveButtonProps) {
  const { recollect } = useSpotSaveFooterContext();
  const hintId = useId();

  return (
    <>
      <span id={hintId} className="sr-only">
        {recollect.savePickerHint}
      </span>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={recollect.busy}
        aria-pressed={recollect.saved}
        aria-describedby={hintId}
        {...saveButtonA11yProps}
        {...recollect.saveHandlers}
      >
        {icon}
        {recollect.saved ? "保存済み" : label}
      </Button>
    </>
  );
}

type MapLinkProps = {
  placeId: string;
  placeName?: string | null;
  place?: PlaceDTO | null;
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
};

/** Google Maps directions link. Context-free: usable outside the provider. */
function SpotSaveMapLink({ placeId, placeName, place, size, className }: MapLinkProps) {
  return (
    <a
      href={googleMapsPlaceUrl({
        placeId,
        name: placeName ?? place?.name,
        location: place?.location,
      })}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant: "outline", size }), className)}
    >
      地図で開く
    </a>
  );
}

/** Save error message; renders nothing while there is no error. */
function SpotSaveError({ className }: { className?: string }) {
  const { recollect } = useSpotSaveFooterContext();

  if (!recollect.error) {
    return null;
  }

  return (
    <p className={cn("text-xs text-destructive", className)} role="alert">
      {recollect.error}
    </p>
  );
}

/** Collection picker sheet host bound to this footer's recollect state. */
function SpotSavePicker() {
  const { spotId, recollect } = useSpotSaveFooterContext();
  return <RecollectPicker spotId={spotId} recollect={recollect} />;
}

type ConsultAgentProps = {
  onClick: () => void;
  children: ReactNode;
  className?: string;
};

/** Optional secondary CTA slot (e.g. エージェントに相談). */
function SpotSaveConsultAgent({ onClick, children, className }: ConsultAgentProps) {
  return (
    <Button
      type="button"
      variant="secondary"
      className={cn("w-full", className)}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export const SpotSaveFooter = Object.assign(SpotSaveFooterRoot, {
  SaveButton: SpotSaveButton,
  MapLink: SpotSaveMapLink,
  Error: SpotSaveError,
  Picker: SpotSavePicker,
  ConsultAgent: SpotSaveConsultAgent,
});
