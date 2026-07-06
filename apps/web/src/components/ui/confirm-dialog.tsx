"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "削除",
  cancelLabel = "キャンセル",
  destructive = true,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleCancel() {
    if (busy) {
      return;
    }
    onCancel();
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        if (busy) {
          event.preventDefault();
        }
      }}
      onClose={handleCancel}
      className={cn(
        "fixed inset-0 z-50 m-auto w-[min(calc(100%-2rem),24rem)] max-w-none rounded-2xl border border-border bg-mogu-surface-elevated p-0 shadow-lg backdrop:bg-black/40",
        "open:animate-in open:fade-in-0 open:zoom-in-95",
      )}
    >
      <div className="space-y-4 p-5">
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={handleCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
