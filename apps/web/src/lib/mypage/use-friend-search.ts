"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { searchUsers } from "@/lib/mypage/browser-api";
import { findDuplicateDisplayNames } from "@/lib/mypage/friend-request-ui";
import type { FriendUser } from "@/lib/mypage/types";
import { formatLoadError } from "@/lib/ui/load-error";

const SEARCH_DEBOUNCE_MS = 300;

export function useFriendSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length === 0) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchUsers(query)
        .then((results) => {
          if (!cancelled) {
            setSearchResults(results);
            setSearchError(null);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setSearchError(formatLoadError(err, "検索に失敗しました"));
            setSearchResults([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSearching(false);
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const duplicateSearchNames = useMemo(
    () => findDuplicateDisplayNames(searchResults),
    [searchResults],
  );

  const handleSearchQueryChange = useCallback((nextQuery: string) => {
    setSearchQuery(nextQuery);
    if (nextQuery.trim().length === 0) {
      setSearchResults([]);
      setSearching(false);
      setSearchError(null);
    }
  }, []);

  const trimmedQuery = searchQuery.trim();
  const showSearchEmpty =
    trimmedQuery.length > 0 &&
    !searching &&
    !searchError &&
    searchResults.length === 0;

  return {
    searchQuery,
    searchResults,
    searching,
    searchError,
    duplicateSearchNames,
    trimmedQuery,
    showSearchEmpty,
    handleSearchQueryChange,
  };
}
