"use client";

import { useId, useState, type FormEvent } from "react";
import { Settings } from "lucide-react";

import { AvatarPhotoField } from "@/components/mypage/avatar-photo-field";
import {
  ProfileFormFields,
  type ProfileFormValues,
} from "@/components/profile/profile-form-fields";
import { NavRow } from "@/components/ui/nav-row";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetFooter,
  SheetHeader,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { updateMeProfile } from "@/lib/mypage/browser-api";
import { notifyProfileUpdated } from "@/lib/mypage/badge-events";
import type { MeProfile } from "@/lib/mypage/types";

type MypageAccountSheetProps = {
  me: MeProfile;
  onProfileUpdated: (
    profile: Pick<MeProfile, "displayName" | "avatarColor" | "avatarUrl">,
  ) => void;
};

export function MypageAccountSheet({
  me,
  onProfileUpdated,
}: MypageAccountSheetProps) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProfileFormValues>({
    displayName: me.displayName,
    avatarColor: me.avatarColor,
    avatarUrl: me.avatarUrl,
  });
  /** Snapshot at sheet open — omit avatarUrl from PATCH when unchanged (#259). */
  const [openedAvatarUrl, setOpenedAvatarUrl] = useState<string | null>(
    me.avatarUrl,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function openSheet() {
    setForm({
      displayName: me.displayName,
      avatarColor: me.avatarColor,
      avatarUrl: me.avatarUrl,
    });
    setOpenedAvatarUrl(me.avatarUrl);
    setError(null);
    setSaved(false);
    setOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const nextAvatarUrl = form.avatarUrl ?? null;
      const avatarChanged = nextAvatarUrl !== openedAvatarUrl;
      const updated = await updateMeProfile({
        displayName: form.displayName,
        avatarColor: form.avatarColor,
        ...(avatarChanged ? { avatarUrl: nextAvatarUrl } : {}),
      });
      onProfileUpdated(updated);
      notifyProfileUpdated();
      setSaved(true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="px-mogu-screen-x">
        <NavRow
          icon={Settings}
          label="アカウントの設定"
          description="名前・写真・アバター色"
          onClick={openSheet}
        />
      </section>

      <Sheet open={open} onClose={() => setOpen(false)}>
        <SheetHeader>アカウントの設定</SheetHeader>
        <SheetBody>
          <form
            id={formId}
            className="space-y-4"
            onSubmit={(event) => void handleSubmit(event)}
          >
            <ProfileFormFields
              values={form}
              onChange={(next) => {
                setForm(next);
                setSaved(false);
              }}
              colorLegend="アバターの色"
              photoField={
                <AvatarPhotoField
                  displayName={form.displayName}
                  avatarColor={form.avatarColor}
                  avatarUrl={form.avatarUrl ?? null}
                  disabled={busy}
                  onChange={(avatarUrl) => {
                    setForm((current) => ({ ...current, avatarUrl }));
                    setSaved(false);
                  }}
                />
              }
            />
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            {saved ? (
              <p className="text-sm text-muted-foreground">保存しました</p>
            ) : null}
          </form>
        </SheetBody>
        <SheetFooter>
          <Button type="submit" form={formId} disabled={busy} className="w-full">
            {busy ? (
              <>
                <Spinner size="sm" />
                保存中…
              </>
            ) : (
              "変更を保存"
            )}
          </Button>
        </SheetFooter>
      </Sheet>
    </>
  );
}
