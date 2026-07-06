"use client";

import { LoaderCircleIcon, LogOut } from "lucide-react";
import { useState, type FormEvent } from "react";

import {
  ProfileFormFields,
  type ProfileFormValues,
} from "@/components/profile/profile-form-fields";
import { useAuth } from "@/contexts/auth-context";
import { updateMeProfile } from "@/lib/mypage/browser-api";
import type { MeProfile } from "@/lib/mypage/types";

type SettingsSectionProps = {
  me: MeProfile;
  onProfileUpdated: (profile: Pick<MeProfile, "displayName" | "avatarColor">) => void;
};

export function SettingsSection({ me, onProfileUpdated }: SettingsSectionProps) {
  const { logout } = useAuth();
  const [form, setForm] = useState<ProfileFormValues>({
    displayName: me.displayName,
    avatarColor: me.avatarColor,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateMeProfile(form);
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
      <h2 className="text-sm font-semibold text-foreground">設定</h2>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="space-y-4 rounded-3xl border border-border bg-mogu-surface-elevated p-4"
      >
        <ProfileFormFields values={form} onChange={setForm} />

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="text-sm text-muted-foreground">プロフィールを保存しました</p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? (
            <>
              <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
              保存中…
            </>
          ) : (
            "プロフィールを保存"
          )}
        </button>
      </form>

      <button
        type="button"
        onClick={() => void logout()}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <LogOut className="size-4" aria-hidden />
        ログアウト
      </button>
    </section>
  );
}
