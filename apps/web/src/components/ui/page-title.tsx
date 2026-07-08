import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageTitleProps = {
  children: ReactNode;
  className?: string;
};

/** Large screen title for tab context (#101). */
export function PageTitle({ children, className }: PageTitleProps) {
  return (
    <h1
      className={cn(
        "text-3xl font-semibold tracking-tight text-foreground",
        className,
      )}
    >
      {children}
    </h1>
  );
}
