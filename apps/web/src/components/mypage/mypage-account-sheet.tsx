"use client";

import { useId, useState, type FormEvent } from "react";
import { LogOut, Settings } from "lucide-react";

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
import { useAuth } from "@/contexts/auth-context";
import { updateMeProfile } from "@/lib/mypage/browser-api";
import { notifyProfileUpdated } from "@/lib/mypage/badge-events";
import type { MeProfile } from "@/lib/mypage/types";

type MypageAccountSheetProps = {
  me: MeProfile;
  onProfileUpdated: (profile: Pick<MeProfile, "displayName" | "avatarColor">) => void;
};

export function MypageAccountSheet({
  me,
  onProfileUpdated,
}: MypageAccountSheetProps) {
  const formId = useId();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProfileFormValues>({
    displayName: me.displayName,
    avatarColor: me.avatarColor,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function openSheet() {
    setForm({
      displayName: me.displayName,
      avatarColor: me.avatarColor,
    });
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
      const updated = await updateMeProfile(form);
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
          description="名前・アバター色"
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
        <SheetFooter className="flex flex-col gap-2">
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
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void logout()}
          >
            <LogOut className="size-4" aria-hidden />
            ログアウト
          </Button>
        </SheetFooter>
      </Sheet>
    </>
  );
}
