import { cn } from "@/lib/utils";
import { touchCardClass } from "@/lib/ui/touch-feedback";

export function SurfaceCard({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="surface-card"
      className={cn(
        "rounded-mogu-card border border-border bg-mogu-surface-elevated shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function SurfaceCardInteractive({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <SurfaceCard
      className={cn("transition-shadow hover:shadow-md", touchCardClass, className)}
      {...props}
    />
  );
}
