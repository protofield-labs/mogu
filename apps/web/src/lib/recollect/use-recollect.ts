"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { getLastRecollectTarget } from "@/lib/recollect/last-target";
import { SAVE_PICKER_HINT } from "@/lib/recollect/save-button-a11y";
import { saveSpotToCollection, unsaveSpot } from "@/lib/recollect/save-spot";
import { useLongPress } from "@/lib/recollect/use-long-press";
import {
  showRecollectRemovedToast,
  showRecollectSuccessToast,
} from "@/lib/ui/recollect-toast";

type UseRecollectOptions = {
  initialSaved?: boolean;
  /**
   * Notified on save/unsave so hosts that remount can restore state (#283).
   * savedCount is the refreshed place-level circle count from the server
   * (null when unavailable, e.g. nothing was deleted).
   */
  onSavedChange?: (saved: boolean, savedCount: number | null) => void;
};

export function useRecollect(spotId: string, options: UseRecollectOptions = {}) {
  const { onSavedChange } = options;
  const initialSaved = options.initialSaved ?? false;
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [prevSpotId, setPrevSpotId] = useState(spotId);
  const [prevInitialSaved, setPrevInitialSaved] = useState(initialSaved);
  const spotIdRef = useRef(spotId);
  // Synchronous double-tap guard: the `busy` state only updates on the next
  // render, so a second pointer event in the same frame would pass an
  // `if (busy)` check and fire a duplicate save/unsave request.
  const inFlightRef = useRef(false);

  // Layout effect: runs synchronously in the same task as the commit, so a
  // pending async result (microtask) can never observe a stale spot id.
  useLayoutEffect(() => {
    spotIdRef.current = spotId;
    // A flight for the previous spot must not block taps on the new one; its
    // late result is already discarded by the isCurrentSpot guard.
    inFlightRef.current = false;
  }, [spotId]);

  // Reset state when the host reuses this hook for another spot (e.g.
  // /spots/A → /spots/B client navigation). A stale saved=true would
  // otherwise unsave the wrong spot now that saved taps delete (#283).
  if (spotId !== prevSpotId) {
    setPrevSpotId(spotId);
    setPrevInitialSaved(initialSaved);
    setSaved(initialSaved);
    setBusy(false);
    setError(null);
    setPickerOpen(false);
  } else if (initialSaved !== prevInitialSaved) {
    // The owner's snapshot changed (e.g. another instance of this spot
    // finished a save/unsave and the feed synced item.savedByMe): follow it
    // so this toggle doesn't fire the opposite mutation on the next tap.
    setPrevInitialSaved(initialSaved);
    setSaved(initialSaved);
  }

  /** In-flight results for a previous spot must not touch current state. */
  const isCurrentSpot = useCallback(
    (id: string) => spotIdRef.current === id,
    [],
  );

  const openPicker = useCallback(() => {
    setError(null);
    setPickerOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
  }, []);

  const handleSaveSuccess = useCallback(
    (collectionName: string, savedCount: number | null) => {
      setSaved(true);
      onSavedChange?.(true, savedCount);
      setPickerOpen(false);
      showRecollectSuccessToast(collectionName, openPicker);
    },
    [onSavedChange, openPicker],
  );

  const performUnsave = useCallback(async () => {
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await unsaveSpot(spotId);
      if (!isCurrentSpot(spotId)) {
        return;
      }
      setBusy(false);

      if (result.ok) {
        setSaved(false);
        onSavedChange?.(false, result.savedCount);
        showRecollectRemovedToast();
        return;
      }

      setError(result.error);
    } finally {
      inFlightRef.current = false;
    }
  }, [isCurrentSpot, onSavedChange, spotId]);

  const performQuickSave = useCallback(async () => {
    if (busy || inFlightRef.current) {
      return;
    }

    // Instagram-style toggle (#283): tapping the saved button removes the
    // recollection instead of doing nothing.
    if (saved) {
      await performUnsave();
      return;
    }

    const target = getLastRecollectTarget();
    if (!target) {
      openPicker();
      return;
    }

    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await saveSpotToCollection(
        spotId,
        target.collectionId,
        target.collectionName,
      );
      if (!isCurrentSpot(spotId)) {
        return;
      }
      setBusy(false);

      if (result.ok) {
        handleSaveSuccess(result.collectionName, result.savedCount);
        return;
      }

      setError(result.error);
      openPicker();
    } finally {
      inFlightRef.current = false;
    }
  }, [busy, handleSaveSuccess, isCurrentSpot, openPicker, performUnsave, saved, spotId]);

  const handlePickerSaved = useCallback(
    (
      _collectionId: string,
      collectionName: string,
      savedCount: number | null,
    ) => {
      handleSaveSuccess(collectionName, savedCount);
    },
    [handleSaveSuccess],
  );

  const longPressHandlers = useLongPress({
    onClick: () => void performQuickSave(),
    onLongPress: openPicker,
  });

  const saveHandlers = {
    ...longPressHandlers,
    // Keyboard alternative to long-press (#290): Shift+Enter opens the picker.
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (event.shiftKey) {
          openPicker();
          return;
        }
        void performQuickSave();
      }
    },
  };

  return {
    saved,
    busy,
    error,
    pickerOpen,
    openPicker,
    closePicker,
    handlePickerSaved,
    saveHandlers,
    savePickerHint: SAVE_PICKER_HINT,
    setSaved,
  };
}
