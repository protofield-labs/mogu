import { cn } from "@/lib/utils";

export function EmptyState({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "rounded-mogu-card border border-dashed border-border bg-mogu-surface-elevated p-8 text-center text-sm text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
