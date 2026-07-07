"use client";

import { useCallback, useState, type KeyboardEvent } from "react";

import { getLastRecollectTarget } from "@/lib/recollect/last-target";
import { saveSpotToCollection } from "@/lib/recollect/save-spot";
import { useLongPress } from "@/lib/recollect/use-long-press";
import { showRecollectSuccessToast } from "@/lib/ui/recollect-toast";

type UseRecollectOptions = {
  initialSaved?: boolean;
};

export function useRecollect(spotId: string, options: UseRecollectOptions = {}) {
  const [saved, setSaved] = useState(options.initialSaved ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const openPicker = useCallback(() => {
    setError(null);
    setPickerOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
  }, []);

  const handleSaveSuccess = useCallback(
    (collectionName: string) => {
      setSaved(true);
      setPickerOpen(false);
      showRecollectSuccessToast(collectionName, openPicker);
    },
    [openPicker],
  );

  const performQuickSave = useCallback(async () => {
    if (saved) {
      return;
    }

    const target = getLastRecollectTarget();
    if (!target) {
      openPicker();
      return;
    }

    setBusy(true);
    setError(null);
    const result = await saveSpotToCollection(
      spotId,
      target.collectionId,
      target.collectionName,
    );
    setBusy(false);

    if (result.ok) {
      handleSaveSuccess(result.collectionName);
      return;
    }

    setError(result.error);
    openPicker();
  }, [handleSaveSuccess, openPicker, saved, spotId]);

  const handlePickerSaved = useCallback(
    (_collectionId: string, collectionName: string) => {
      handleSaveSuccess(collectionName);
    },
    [handleSaveSuccess],
  );

  const longPressHandlers = useLongPress({
    onClick: () => void performQuickSave(),
    onLongPress: openPicker,
  });

  const saveHandlers = {
    ...longPressHandlers,
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
    setSaved,
  };
}
