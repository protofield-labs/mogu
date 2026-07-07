import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

export const fieldVariants = cva(
  "w-full border border-border bg-background text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      fieldSize: {
        default: "h-11 rounded-2xl px-4",
        sm: "h-9 rounded-xl px-3",
      },
    },
    defaultVariants: {
      fieldSize: "default",
    },
  },
);

export function Input({
  className,
  fieldSize,
  ...props
}: React.ComponentProps<"input"> & VariantProps<typeof fieldVariants>) {
  return (
    <input
      data-slot="input"
      className={cn(fieldVariants({ fieldSize }), className)}
      {...props}
    />
  );
}

export function Select({
  className,
  fieldSize,
  ...props
}: React.ComponentProps<"select"> & VariantProps<typeof fieldVariants>) {
  return (
    <select
      data-slot="select"
      className={cn(fieldVariants({ fieldSize }), className)}
      {...props}
    />
  );
}
