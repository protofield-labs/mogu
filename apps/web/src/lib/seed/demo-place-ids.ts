/**
 * Real Google place_id values for demo persona collections (#317).
 * Resolved via Places Text Search — re-run scripts/resolve-demo-place-ids.ts to refresh.
 */
export const DEMO_PLACE_IDS = {
  /** 個室とワイン 大衆SAKEBARるぺーる（中目黒）— shared savedCount demo */
  sharedNakameguro: "ChIJ__8Ao0mLGGARqco8Qv7rgQE",
  /** 酒とつまみ じょうご（中目黒）— counter izakaya */
  kenNakaCounter: "ChIJT9mf4JWLGGARGC6LYVlPID8",
  /** 呑喰らい（恵比寿）— standing bar */
  kenEbisuStanding: "ChIJrbiqXqyLGGAR0jsoROkL98o",
  /** ブイヨン（恵比寿南）— after-work bistro */
  kenOfficeBistro: "ChIJ8-eSKuyLGGARdUVx0tt6Ipk",
  /** Sweets&bar Mont Pignon Tokyo（中目黒）— quiet wine bar */
  aoiNakaWine: "ChIJYyQeve-LGGARomPzc4Ams5A",
  /** ル・フォワイエ 恵比寿 — date French */
  aoiEbisuDate: "ChIJM8HJawCLGGARDnhPDXyanPs",
  /** ES Classico 恵比寿 — anniversary French */
  aoiAnniversary: "ChIJ9aUCyBSLGGARKi-j5-iXDHU",
} as const;

export type DemoPlaceIdKey = keyof typeof DEMO_PLACE_IDS;

export const DEMO_PLACE_ID_VALUES: readonly string[] = Object.values(DEMO_PLACE_IDS);

/** Shared place_id for savedCount demo (輪でn人が保存). */
export const DEMO_SHARED_PLACE_ID = DEMO_PLACE_IDS.sharedNakameguro;
