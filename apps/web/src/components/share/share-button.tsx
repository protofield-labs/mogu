"use client";

import { Share2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useShare } from "@/lib/share/use-share";

type ShareButtonProps = {
  url: string;
  title?: string;
  text?: string;
  label?: string;
  className?: string;
  size?: "sm" | "icon-sm";
  variant?: "ghost" | "outline" | "secondary";
};

export function ShareButton({
  url,
  title,
  text,
  label = "共有",
  className,
  size = "icon-sm",
  variant = "ghost",
}: ShareButtonProps) {
  const { share } = useShare();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      aria-label={label}
      onClick={() => void share({ url, title, text })}
    >
      <Share2Icon className="size-4" aria-hidden />
      {size === "sm" ? label : null}
    </Button>
  );
}
