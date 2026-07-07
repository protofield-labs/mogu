import { toast } from "sonner";

export function showRecollectSuccessToast(
  collectionName: string,
  onChange?: () => void,
): void {
  toast.success(`「${collectionName}」に保存しました`, {
    action: onChange
      ? {
          label: "変更",
          onClick: onChange,
        }
      : undefined,
  });
}
