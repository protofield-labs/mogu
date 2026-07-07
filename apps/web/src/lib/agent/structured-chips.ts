export type StructuredChipGroup = {
  id: string;
  label: string;
  options: string[];
};

/** features 2-2: area / party size / genre / mood chips for first turn. */
export const STRUCTURED_CHIP_GROUPS: StructuredChipGroup[] = [
  {
    id: "area",
    label: "エリア",
    options: ["恵比寿", "中目黒", "渋谷", "新宿"],
  },
  {
    id: "party",
    label: "人数",
    options: ["1人", "2人", "3〜4人", "5人以上"],
  },
  {
    id: "genre",
    label: "ジャンル",
    options: ["和食", "イタリアン", "中華", "カフェ"],
  },
  {
    id: "mood",
    label: "気分",
    options: ["サクッと", "じっくり", "静かに", "にぎやかに"],
  },
];

export type StructuredChipSelections = Partial<
  Record<(typeof STRUCTURED_CHIP_GROUPS)[number]["id"], string>
>;

export function structuredSelectionsToChips(
  selections: StructuredChipSelections,
): string[] {
  return STRUCTURED_CHIP_GROUPS.map((group) => selections[group.id]).filter(
    (value): value is string => Boolean(value),
  );
}

export function buildStructuredChipPrompt(
  selections: StructuredChipSelections,
): string {
  const chips = structuredSelectionsToChips(selections);
  if (chips.length === 0) {
    return "";
  }
  return `今夜は${chips.join("・")}で探しています`;
}
