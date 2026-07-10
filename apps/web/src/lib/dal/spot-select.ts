export const spotCoreSelect = {
  id: true,
  placeId: true,
  addedBy: true,
  collectionId: true,
  photoUrls: true,
  comment: true,
  rating: true,
  tagArea: true,
  tagGenre: true,
  tagSituation: true,
  freeTags: true,
  originUserId: true,
  depth: true,
  createdAt: true,
} as const;

export const spotFeedSelect = {
  ...spotCoreSelect,
  collection: { select: { name: true } },
  addedByUser: {
    select: {
      firebaseUid: true,
      displayName: true,
      avatarColor: true,
      avatarUrl: true,
    },
  },
} as const;
