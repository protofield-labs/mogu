import { type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

import { fieldVariants } from "./input";

export function Textarea({
  className,
  fieldSize,
  ...props
}: React.ComponentProps<"textarea"> & VariantProps<typeof fieldVariants>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        fieldVariants({ fieldSize }),
        "min-h-20 resize-none py-2",
        className,
      )}
      {...props}
    />
  );
}
