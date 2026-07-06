import { toast } from "sonner";

export function showRecollectSuccessToast(collectionName: string): void {
  toast.success(`「${collectionName}」に保存しました`);
}
