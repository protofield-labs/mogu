/** Demo seed constants (#46). Fixed IDs for idempotent re-seeding. */

export type DemoUserDef = {
  uid: string;
  displayName: string;
  avatarColor: string;
};

export const DEMO_PERSONAS = {
  ken: {
    uid: "demo-ken",
    displayName: "Ken",
    avatarColor: "#3B6EA8",
  },
  aoi: {
    uid: "demo-aoi",
    displayName: "Aoi",
    avatarColor: "#C45C8A",
  },
  mika: {
    uid: "demo-mika",
    displayName: "Mika",
    avatarColor: "#6B9080",
  },
} as const satisfies Record<string, DemoUserDef>;

export const DEMO_VIEWER_DEFAULT: DemoUserDef = {
  uid: "demo-viewer",
  displayName: "あなた",
  avatarColor: "#888888",
};

export { DEMO_SHARED_PLACE_ID } from "./demo-place-ids";

export const DEMO_COLLECTION_IDS = {
  kenIzakaya: "11111111-1111-4111-8111-111111111101",
  kenOffice: "11111111-1111-4111-8111-111111111102",
  aoiQuiet: "11111111-1111-4111-8111-111111111201",
  aoiAnniversary: "11111111-1111-4111-8111-111111111202",
  viewerWishlist: "11111111-1111-4111-8111-111111111301",
  mikaCasual: "11111111-1111-4111-8111-111111111401",
} as const;

export const DEMO_SPOT_IDS = {
  kenSharedIzakaya: "22222222-2222-4222-8222-222222222201",
  kenNakaCounter: "22222222-2222-4222-8222-222222222202",
  kenEbisuStanding: "22222222-2222-4222-8222-222222222203",
  kenOfficeBistro: "22222222-2222-4222-8222-222222222204",
  aoiSharedQuiet: "22222222-2222-4222-8222-222222222301",
  aoiNakaWine: "22222222-2222-4222-8222-222222222302",
  aoiEbisuDate: "22222222-2222-4222-8222-222222222303",
  aoiAnniversary: "22222222-2222-4222-8222-222222222304",
  mikaSharedSpot: "22222222-2222-4222-8222-222222222401",
  mikaRecoFromAoi: "22222222-2222-4222-8222-222222222402",
  viewerRecoFromKen: "22222222-2222-4222-8222-222222222501",
} as const;

export const DEMO_DAILY_RECO_ID = "33333333-3333-4333-8333-333333333301";

export function demoUserIds(viewerUid: string): string[] {
  return [
    viewerUid,
    DEMO_PERSONAS.ken.uid,
    DEMO_PERSONAS.aoi.uid,
    DEMO_PERSONAS.mika.uid,
  ];
}

export function isDemoUid(uid: string): boolean {
  return uid === DEMO_VIEWER_DEFAULT.uid || uid.startsWith("demo-");
}
