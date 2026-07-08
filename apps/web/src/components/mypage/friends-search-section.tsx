"use client";

import { Search } from "lucide-react";

import {
  friendAvatarProps,
} from "@/components/mypage/incoming-friend-request-list";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { formatAvatarColorLabel } from "@/lib/mypage/friend-request-ui";
import type { FriendUser } from "@/lib/mypage/types";

type FriendsSearchSectionProps = {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: FriendUser[];
  searching: boolean;
  searchError: string | null;
  showSearchEmpty: boolean;
  trimmedQuery: string;
  duplicateSearchNames: Set<string>;
  renderSendButton: (user: FriendUser) => React.ReactNode;
};

export function FriendsSearchSection({
  searchQuery,
  onSearchQueryChange,
  searchResults,
  searching,
  searchError,
  showSearchEmpty,
  trimmedQuery,
  duplicateSearchNames,
  renderSendButton,
}: FriendsSearchSectionProps) {
  return (
    <>
      <div className="px-mogu-screen-x">
        <label className="relative block">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="名前で友達を探す"
            className="h-11 w-full rounded-2xl border border-border bg-background pl-10 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
      </div>

      {searchError ? (
        <p className="px-mogu-screen-x text-sm text-destructive" role="alert">
          {searchError}
        </p>
      ) : null}

      {searching ? (
        <p className="px-mogu-screen-x text-sm text-muted-foreground">検索中…</p>
      ) : null}

      {showSearchEmpty ? (
        <p className="px-mogu-screen-x text-sm text-muted-foreground">
          「{trimmedQuery}」に一致するユーザーが見つかりませんでした
        </p>
      ) : null}

      {searchResults.length > 0 ? (
        <section className="space-y-2 px-mogu-screen-x">
          <h2 className="text-xs font-medium text-muted-foreground">検索結果</h2>
          <ul className="space-y-2">
            {searchResults.map((user) => {
              const showColorHint = duplicateSearchNames.has(user.displayName);
              return (
                <li
                  key={user.id}
                  className="flex items-center gap-3 rounded-2xl bg-mogu-surface-elevated p-3 shadow-mogu-card"
                >
                  <Avatar
                    {...friendAvatarProps(user, {
                      emphasizeColor: showColorHint,
                      showInitial: !showColorHint,
                    })}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {user.displayName}
                    </p>
                    {showColorHint ? (
                      <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span
                          className="inline-block size-3 rounded-full border border-border"
                          style={{ backgroundColor: user.avatarColor }}
                          aria-hidden
                        />
                        {formatAvatarColorLabel(user.avatarColor)}
                      </p>
                    ) : null}
                  </div>
                  {renderSendButton(user)}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
