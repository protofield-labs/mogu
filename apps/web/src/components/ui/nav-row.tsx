"use client";

import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { touchRowClass } from "@/lib/ui/touch-feedback";
import { cn } from "@/lib/utils";

type NavRowProps = {
  icon: LucideIcon;
  label: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  trailing?: ReactNode;
  className?: string;
};

const rowClassName = cn(
  "flex min-h-14 w-full items-center gap-3 rounded-mogu-card bg-mogu-surface-elevated px-4 py-3 text-left shadow-sm transition-shadow hover:shadow-md",
  touchRowClass,
);

/** Settings-style full-width navigation row (#101). */
export function NavRow({
  icon: Icon,
  label,
  description,
  href,
  onClick,
  trailing,
  className,
}: NavRowProps) {
  const content = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-foreground" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
      {trailing ?? (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn(rowClassName, className)}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(rowClassName, className)}
    >
      {content}
    </button>
  );
}
