"use client";

import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CollectionVisibility } from "@/lib/collections/browser-api";
import { formatCollectionVisibility } from "@/lib/labels/collection-labels";

export type CollectionForm = {
  name: string;
  description: string;
  visibility: CollectionVisibility;
  theme: string;
};

export const emptyCollectionForm: CollectionForm = {
  name: "",
  description: "",
  visibility: "friends",
  theme: "",
};

type CollectionFormFieldsProps = {
  form: CollectionForm;
  onChange: (next: CollectionForm) => void;
};

export function CollectionFormFields({ form, onChange }: CollectionFormFieldsProps) {
  return (
    <div className="space-y-3">
      <Label>
        <span>名前</span>
        <Input
          type="text"
          required
          maxLength={80}
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
          placeholder="週末に行きたい店"
        />
      </Label>
      <Label>
        <span>説明</span>
        <Textarea
          maxLength={240}
          value={form.description}
          onChange={(event) =>
            onChange({ ...form, description: event.target.value })
          }
          placeholder="どんなコレクションかメモ"
        />
      </Label>
      <div className="grid grid-cols-2 gap-3">
        <Label>
          <span>公開範囲</span>
          <Select
            value={form.visibility}
            onChange={(event) =>
              onChange({
                ...form,
                visibility: event.target.value as CollectionVisibility,
              })
            }
          >
            <option value="friends">{formatCollectionVisibility("friends")}</option>
            <option value="secret">{formatCollectionVisibility("secret")}</option>
          </Select>
        </Label>
        <Label>
          <span>テーマ</span>
          <Input
            type="text"
            maxLength={80}
            value={form.theme}
            onChange={(event) => onChange({ ...form, theme: event.target.value })}
            placeholder="デート"
          />
        </Label>
      </div>
    </div>
  );
}
