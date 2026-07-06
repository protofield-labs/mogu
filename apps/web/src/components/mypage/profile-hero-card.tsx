"use client";

import Link from "next/link";
import { LoaderCircleIcon } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import {
  ProfileFormFields,
  type ProfileFormValues,
} from "@/components/profile/profile-form-fields";
import { Button } from "@/components/ui/button";
import {
  formatStatsRow,
  shouldShowFriendRequestBadge,
} from "@/lib/mypage/stats-row";
import { updateMeProfile } from "@/lib/mypage/browser-api";
import type { MeProfile } from "@/lib/mypage/types";
import { cn } from "@/lib/utils";

type ProfileHeroCardProps = {
  me: MeProfile;
  pendingFriendRequests: number;
  onProfileUpdated: (profile: Pick<MeProfile, "displayName" | "avatarColor">) => void;
};

/**
 * Profile hero card (#103): tap to flip into inline profile edit.
 */
export function ProfileHeroCard({
  me,
  pendingFriendRequests,
  onProfileUpdated,
}: ProfileHeroCardProps) {
  const editPanelId = useId();
  const stats = formatStatsRow(me.counts);
  const showFriendBadge = shouldShowFriendRequestBadge(pendingFriendRequests);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileFormValues>({
    displayName: me.displayName,
    avatarColor: me.avatarColor,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function openEdit() {
    setForm({
      displayName: me.displayName,
      avatarColor: me.avatarColor,
    });
    setError(null);
    setSaved(false);
    setEditing(true);
  }

  function handleCancelEdit() {
    setEditing(false);
    setForm({
      displayName: me.displayName,
      avatarColor: me.avatarColor,
    });
    setError(null);
    setSaved(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateMeProfile(form);
      setForm({
        displayName: updated.displayName,
        avatarColor: updated.avatarColor,
      });
      onProfileUpdated(updated);
      setSaved(true);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="px-mogu-screen-x">
      <div className="[perspective:1000px]">
        <div
          className={cn(
            "relative h-[13rem] w-full transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none",
            editing && "[transform:rotateY(180deg)]",
          )}
        >
          <div
            role="button"
            tabIndex={editing ? -1 : 0}
            aria-expanded={editing}
            aria-controls={editPanelId}
            inert={editing}
            onClick={() => {
              if (!editing) {
                openEdit();
              }
            }}
            onKeyDown={(event) => {
              if (editing || event.target !== event.currentTarget) {
                return;
              }
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openEdit();
              }
            }}
            className={cn(
              "absolute inset-0 flex cursor-pointer items-stretch gap-5 overflow-hidden rounded-mogu-card bg-mogu-surface-elevated p-5 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [backface-visibility:hidden]",
              editing && "pointer-events-none",
            )}
          >
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-2">
              <span
                className="flex size-24 items-center justify-center rounded-full text-3xl font-semibold text-white shadow-sm"
                style={{ backgroundColor: me.avatarColor }}
                aria-hidden
              >
                {me.displayName.slice(0, 1) || "?"}
              </span>
              <div className="min-w-0 text-center">
                <h2 className="truncate text-lg font-semibold text-foreground">
                  {me.displayName}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">タップして編集</p>
              </div>
            </div>

            <dl className="flex w-32 shrink-0 flex-col justify-center divide-y divide-border">
              <div className="py-2.5">
                <dd className="text-base font-semibold text-foreground">
                  {me.counts.collections}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    コレクション
                  </span>
                </dd>
              </div>
              <div className="py-2.5">
                <dd className="text-base font-semibold text-foreground">
                  {me.counts.spots}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    スポット
                  </span>
                </dd>
              </div>
              <div
                className="py-2.5"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <dd>
                  <Link
                    href="/mypage/friends"
                    tabIndex={editing ? -1 : undefined}
                    className="relative inline-flex items-baseline text-base font-semibold text-foreground underline-offset-4 hover:underline"
                    aria-label={stats.friendsLabel}
                  >
                    {me.counts.friends}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      友達
                    </span>
                    {showFriendBadge ? (
                      <span
                        className="absolute -right-2.5 -top-1 size-2 rounded-full bg-mogu-badge"
                        aria-label="友達申請あり"
                      />
                    ) : null}
                  </Link>
                </dd>
              </div>
            </dl>
          </div>

          <div
            id={editPanelId}
            inert={!editing}
            className={cn(
              "absolute inset-0 overflow-hidden rounded-mogu-card bg-mogu-surface-elevated shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)]",
              !editing && "pointer-events-none",
            )}
          >
            <form
              onSubmit={(event) => void handleSubmit(event)}
              className="flex h-full flex-col gap-2 overflow-hidden p-3"
            >
              <div className="min-h-0 flex-1 space-y-2 overflow-hidden">
                <ProfileFormFields
                  compact
                  values={form}
                  onChange={(next) => {
                    setForm(next);
                    setSaved(false);
                  }}
                  colorLegend="アバターの色"
                />
              </div>

              {error ? (
                <p className="shrink-0 truncate text-xs text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              {saved ? (
                <p className="shrink-0 text-xs text-muted-foreground">保存しました</p>
              ) : null}

              <div className="flex shrink-0 gap-2 pt-0.5">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={handleCancelEdit}
                  className="h-9 flex-1 rounded-lg text-sm"
                >
                  戻る
                </Button>
                <Button
                  type="submit"
                  disabled={busy}
                  className="h-9 flex-1 rounded-lg text-sm"
                >
                  {busy ? (
                    <>
                      <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
                      保存中…
                    </>
                  ) : (
                    "保存"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
