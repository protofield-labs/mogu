"use client";

import { CollectionPickerSheet } from "@/components/recollect/collection-picker-sheet";
import type { useRecollect } from "@/lib/recollect/use-recollect";

type RecollectPickerProps = {
  spotId: string;
  recollect: ReturnType<typeof useRecollect>;
};

export function RecollectPicker({ spotId, recollect }: RecollectPickerProps) {
  return (
    <CollectionPickerSheet
      open={recollect.pickerOpen}
      spotId={spotId}
      busy={recollect.busy}
      onClose={recollect.closePicker}
      onSaved={recollect.handlePickerSaved}
    />
  );
}
