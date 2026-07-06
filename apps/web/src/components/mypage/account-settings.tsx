"use client";

import {
  ChevronDown,
  ChevronRight,
  LoaderCircleIcon,
  LogOut,
  Settings,
} from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import {
  ProfileFormFields,
  type ProfileFormValues,
} from "@/components/profile/profile-form-fields";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { updateMeProfile } from "@/lib/mypage/browser-api";
import type { MeProfile } from "@/lib/mypage/types";

type AccountSettingsProps = {
  me: MeProfile;
  onProfileUpdated: (profile: Pick<MeProfile, "displayName" | "avatarColor">) => void;
};

/**
 * Airbnb-style settings row (#101): full-width nav row that expands
 * into the profile edit form (#81), with logout inside.
 */
export function AccountSettings({ me, onProfileUpdated }: AccountSettingsProps) {
  const { logout } = useAuth();
  const panelId = useId();
  const [open, setOpen] = useState(false);
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
    <section className="px-mogu-screen-x">
      <div className="overflow-hidden rounded-3xl bg-mogu-surface-elevated shadow-sm">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
          className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
            <Settings className="size-4.5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">
              アカウントの設定
            </span>
            <span className="block text-xs text-muted-foreground">
              名前・アバターの色・ログアウト
            </span>
          </span>
          {open ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
        </button>

        {open ? (
          <div id={panelId} className="border-t border-border">
            <form
              onSubmit={(event) => void handleSubmit(event)}
              className="space-y-4 px-4 pb-4 pt-3"
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

              <Button
                type="submit"
                disabled={busy}
                className="h-10 w-full rounded-2xl"
              >
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

            <button
              type="button"
              onClick={() => void logout()}
              className="flex w-full items-center gap-3 border-t border-border p-4 text-left transition-colors hover:bg-muted/40"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <LogOut className="size-4.5" aria-hidden />
              </span>
              <span className="flex-1 text-sm font-medium text-foreground">
                ログアウト
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
