"use client";

import Link from "next/link";
import { LoaderCircleIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

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
    <section className="space-y-5 px-mogu-screen-x">
      <div className="flex items-center gap-3">
        <div
          className="flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white transition-colors"
          style={{ backgroundColor: form.avatarColor }}
          aria-hidden
        >
          {previewInitial}
        </div>
        <div>
          <h1 className="text-base font-semibold text-foreground">
            {form.displayName.trim() || me.displayName}
          </h1>
          <p className="text-sm text-muted-foreground">あなた</p>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-mogu-surface-elevated px-2 py-3">
          <dt className="text-xs text-muted-foreground">棚</dt>
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

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="space-y-4 rounded-3xl border border-border bg-mogu-surface-elevated p-4"
      >
        <div>
          <h2 className="text-sm font-semibold text-foreground">プロフィール編集</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            名前とアバターの色は友達に表示されます
          </p>
        </div>

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
    </section>
  );
}
