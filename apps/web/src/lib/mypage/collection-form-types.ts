import type { CollectionVisibility } from "@/lib/collections/browser-api";

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
