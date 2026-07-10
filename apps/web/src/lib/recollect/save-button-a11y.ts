/** Hint for opening the collection picker via long-press or Shift+Enter (#290). */
export const SAVE_PICKER_HINT =
  "長押しまたは Shift+Enter で保存先を選ぶ";

export function saveIconButtonAriaLabel(saved: boolean): string {
  if (saved) {
    return `保存済み。タップで保存を解除。${SAVE_PICKER_HINT}`;
  }
  return `保存。${SAVE_PICKER_HINT}`;
}

export const saveButtonA11yProps = {
  "aria-haspopup": "dialog" as const,
  title: SAVE_PICKER_HINT,
};
