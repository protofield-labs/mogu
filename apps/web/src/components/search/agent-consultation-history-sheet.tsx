"use client";

import { HistoryIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  listAgentConsultations,
  type AgentConsultationSummary,
} from "@/lib/agent/browser-api";
import { formatRelativeTime } from "@/lib/mypage/notifications";

type AgentConsultationHistorySheetProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (consultation: AgentConsultationSummary) => void;
};

export function AgentConsultationHistorySheet({
  open,
  onClose,
  onSelect,
}: AgentConsultationHistorySheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [consultations, setConsultations] = useState<AgentConsultationSummary[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const result = await listAgentConsultations();
        if (!cancelled) {
          setConsultations(result);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "相談履歴を読み込めませんでした",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[min(85dvh,640px)] w-full max-w-none rounded-t-2xl border border-border bg-mogu-surface-elevated p-0 shadow-lg backdrop:bg-black/40 sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(80dvh,640px)] sm:w-[min(100%,28rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
    >
      <div className="flex max-h-[inherit] flex-col">
        <div className="flex items-center justify-between border-b border-border px-mogu-screen-x py-3">
          <div className="flex items-center gap-2">
            <HistoryIcon className="size-4 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-semibold text-foreground">相談履歴</h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="閉じる"
            onClick={onClose}
          >
            <XIcon />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-mogu-screen-x py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : consultations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              まだ相談履歴がありません。エージェントに相談するとここに表示されます。
            </p>
          ) : (
            <ul className="space-y-2">
              {consultations.map((consultation) => (
                <li key={consultation.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(consultation)}
                    className="flex w-full flex-col gap-1 rounded-2xl border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <span className="line-clamp-2 text-sm font-medium text-foreground">
                      {consultation.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(consultation.updatedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </dialog>
  );
}
