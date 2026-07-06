"use client";

import Link from "next/link";
import { ChevronDown, LoaderCircleIcon, Pencil } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import {
  ProfileFormFields,
  type ProfileFormValues,
} from "@/components/profile/profile-form-fields";
import { Button } from "@/components/ui/button";
import { updateMeProfile } from "@/lib/mypage/browser-api";
import {
  formatStatsRow,
  shouldShowFriendRequestBadge,
} from "@/lib/mypage/stats-row";
import type { MeProfile } from "@/lib/mypage/types";
import { cn } from "@/lib/utils";

type ProfileSectionProps = {
  me: MeProfile;
  pendingFriendRequests: number;
  onProfileUpdated: (profile: Pick<MeProfile, "displayName" | "avatarColor">) => void;
};

export function ProfileSection({
  me,
  pendingFriendRequests,
  onProfileUpdated,
}: ProfileSectionProps) {
  const formId = useId();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileFormValues>({
    displayName: me.displayName,
    avatarColor: me.avatarColor,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const stats = formatStatsRow(me.counts);
  const showFriendBadge = shouldShowFriendRequestBadge(pendingFriendRequests);
  const previewInitial = form.displayName.trim().slice(0, 1) || "?";

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 px-mogu-screen-x">
      <div className="overflow-hidden rounded-3xl border border-border bg-mogu-surface-elevated">
        <button
          type="button"
          aria-expanded={editing}
          aria-controls={formId}
          onClick={() => setEditing((current) => !current)}
          className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40"
        >
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white transition-colors"
            style={{ backgroundColor: editing ? form.avatarColor : me.avatarColor }}
            aria-hidden
          >
            {(editing ? previewInitial : me.displayName.slice(0, 1)) || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-foreground">
              {editing ? form.displayName.trim() || me.displayName : me.displayName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {editing ? "名前とアバターの色を編集" : "あなた · タップして編集"}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {editing ? (
              <>
                <ChevronDown className="size-3.5 rotate-180" aria-hidden />
                閉じる
              </>
            ) : (
              <>
                <Pencil className="size-3.5" aria-hidden />
                編集
              </>
            )}
          </span>
        </button>

        {editing ? (
          <form
            id={formId}
            onSubmit={(event) => void handleSubmit(event)}
            className="space-y-4 border-t border-border px-4 pb-4 pt-3"
          >
            <ProfileFormFields
              values={form}
              onChange={(next) => {
                setForm(next);
                setSaved(false);
              }}
              colorLegend="アバターの色"
            />

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            {saved ? (
              <p className="text-sm text-muted-foreground">保存しました</p>
            ) : null}

            <Button type="submit" disabled={busy} className="h-10 w-full rounded-2xl">
              {busy ? (
                <>
                  <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
                  保存中…
                </>
              ) : (
                "保存"
              )}
            </Button>
          </form>
        ) : null}
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-mogu-surface-elevated px-2 py-3">
          <dt className="text-xs text-muted-foreground">コレクション</dt>
          <dd className="mt-1 text-sm font-semibold text-foreground">
            {stats.collectionsLabel}
          </dd>
        </div>
        <div className="rounded-2xl bg-mogu-surface-elevated px-2 py-3">
          <dt className="text-xs text-muted-foreground">スポット</dt>
          <dd className="mt-1 text-sm font-semibold text-foreground">
            {stats.spotsLabel}
          </dd>
        </div>
        <div className="rounded-2xl bg-mogu-surface-elevated px-2 py-3">
          <dt className="text-xs text-muted-foreground">友達</dt>
          <dd className="mt-1">
            <Link
              href="/mypage/friends"
              className={cn(
                "relative inline-flex text-sm font-semibold text-foreground underline-offset-4 hover:underline",
              )}
            >
              {stats.friendsLabel}
              {showFriendBadge ? (
                <span
                  className="absolute -right-2 -top-1 size-2 rounded-full bg-mogu-badge"
                  aria-label="友達申請あり"
                />
              ) : null}
            </Link>
          </dd>
        </div>
      </dl>
    </section>
  );
}
