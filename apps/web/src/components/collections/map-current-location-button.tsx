"use client";

import { LocateFixed } from "lucide-react";

import { Spinner } from "@/components/ui/spinner";
import { touchIconClass } from "@/lib/ui/touch-feedback";
import { cn } from "@/lib/utils";

type MapCurrentLocationButtonProps = {
  pending: boolean;
  active: boolean;
  onClick: () => void;
};

export function MapCurrentLocationButton({
  pending,
  active,
  onClick,
}: MapCurrentLocationButtonProps) {
  return (
    <button
      type="button"
      aria-label="現在地を表示"
      aria-pressed={active}
      disabled={pending}
      onClick={onClick}
      className={cn(
        "absolute bottom-4 right-4 z-20 flex size-11 items-center justify-center rounded-full border border-border bg-mogu-surface-elevated shadow-md",
        touchIconClass,
        pending && "opacity-70",
      )}
    >
      {pending ? (
        <Spinner size="sm" />
      ) : (
        <LocateFixed
          className={cn("size-5", active ? "text-primary" : "text-foreground")}
          aria-hidden
        />
      )}
    </button>
  );
}
