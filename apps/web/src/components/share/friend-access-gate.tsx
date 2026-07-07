"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { sendFriendRequest } from "@/lib/mypage/browser-api";

type FriendAccessGateProps = {
  ownerDisplayName: string;
  ownerId: string;
  resourceLabel: string;
};

export function FriendAccessGate({
  ownerDisplayName,
  ownerId,
  resourceLabel,
}: FriendAccessGateProps) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequest() {
    if (busy || sent) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendFriendRequest(ownerId);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "友達申請に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-mogu-screen-x py-16 text-center">
      <p className="text-base font-semibold text-foreground">
        {ownerDisplayName}さんと友達になると{resourceLabel}を見られます
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        友達申請が承認されると、コレクションとスポットを閲覧できます。
      </p>
      <Button
        type="button"
        disabled={busy || sent}
        onClick={() => void handleRequest()}
      >
        {sent ? "申請済み" : busy ? "送信中…" : "友達申請する"}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
