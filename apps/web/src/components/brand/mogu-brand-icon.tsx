import { Beef } from "lucide-react";

import { cn } from "@/lib/utils";

type MoguBrandIconProps = {
  className?: string;
};

/** Shared mogu brand mark (food / meat theme) for tab, headers, and agent avatar. */
export function MoguBrandIcon({ className }: MoguBrandIconProps) {
  return <Beef className={cn("shrink-0", className)} aria-hidden />;
}
