import { LoaderCircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
} as const;

type SpinnerProps = {
  className?: string;
  size?: keyof typeof sizeClasses;
  label?: string;
};

export function Spinner({ className, size = "md", label }: SpinnerProps) {
  return (
    <LoaderCircleIcon
      data-slot="spinner"
      className={cn(sizeClasses[size], "animate-spin", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
    />
  );
}
