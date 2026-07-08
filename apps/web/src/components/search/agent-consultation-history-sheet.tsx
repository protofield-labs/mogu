"use client";

import { HistoryIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Sheet, SheetBody, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  const [consultations, setConsultations] = useState<AgentConsultationSummary[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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
    <Sheet open={open} onClose={onClose} ariaLabel="相談履歴" className="max-h-[min(85dvh,640px)] sm:max-h-[min(80dvh,640px)]">
      <SheetHeader>
        <div className="flex items-center gap-2">
          <HistoryIcon className="size-4 text-muted-foreground" aria-hidden />
          <SheetTitle>相談履歴</SheetTitle>
        </div>
      </SheetHeader>

      <SheetBody>
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
      </SheetBody>
    </Sheet>
  );
}
