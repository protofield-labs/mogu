"use client";

import { useCallback } from "react";
import { toast } from "sonner";

type ShareInput = {
  url: string;
  title?: string;
  text?: string;
};

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  return copied;
}

export function useShare() {
  const share = useCallback(async ({ url, title, text }: ShareInput) => {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({
          url,
          ...(title ? { title } : {}),
          ...(text ? { text } : {}),
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    const copied = await copyToClipboard(url);
    if (copied) {
      toast.success("リンクをコピーしました");
      return;
    }
    toast.error("リンクをコピーできませんでした");
  }, []);

  return { share };
}
