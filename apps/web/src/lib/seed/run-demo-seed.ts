/**
 * Demo seed for hackathon / local dev (#46).
 * Optional env:
 *   SEED_VIEWER_UID — link demo personas to your Firebase uid (default: demo-viewer)
 */
import { PrismaClient, Rating } from "@prisma/client";

import type { DemoUserDef } from "./demo-data";
import {
  DEMO_COLLECTION_IDS,
  DEMO_DAILY_RECO_ID,
  DEMO_PERSONAS,
  DEMO_SHARED_PLACE_ID,
  DEMO_SPOT_IDS,
  DEMO_VIEWER_DEFAULT,
  demoUserIds,
  friendshipPair,
} from "./demo-data";
import {
  disableDemoSeedFlags,
  enableDemoSeedFlags,
  withSeedRls,
} from "./rls";

type SeedTx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

const DEMO_RECO_EDGE_IDS = {
  viewerFromKen: "44444444-4444-4444-8444-444444444401",
  mikaFromAoi: "44444444-4444-4444-8444-444444444402",
} as const;

function resolveViewerUid(): string {
  return process.env.SEED_VIEWER_UID?.trim() || DEMO_VIEWER_DEFAULT.uid;
}

function resolveViewerProfile(viewerUid: string) {
  if (viewerUid === DEMO_VIEWER_DEFAULT.uid) {
    return DEMO_VIEWER_DEFAULT;
  }
  return {
    uid: viewerUid,
    displayName: process.env.SEED_VIEWER_NAME?.trim() || "Demo User",
    avatarColor: process.env.SEED_VIEWER_AVATAR?.trim() || "#888888",
  };
}

async function wipeDemoRows(tx: SeedTx, viewerUid: string) {
  const demoCollections = Object.values(DEMO_COLLECTION_IDS);
  const demoSpots = Object.values(DEMO_SPOT_IDS);
  const demoEdges = Object.values(DEMO_RECO_EDGE_IDS);
  const personaUids = Object.values(DEMO_PERSONAS).map((p) => p.uid);
  const allUids = demoUserIds(viewerUid);

  await enableDemoSeedFlags(tx);

  await tx.flag.deleteMany({
    where: { recipientId: { in: allUids } },
  });
  await tx.dailyRecommendation.deleteMany({
    where: { userId: { in: allUids } },
  });
  await tx.recollectionEdge.deleteMany({
    where: { id: { in: demoEdges } },
  });
  await tx.spot.deleteMany({
    where: {
      OR: [
        { id: { in: demoSpots } },
        { collectionId: { in: demoCollections } },
      ],
    },
  });
  await tx.collection.deleteMany({
    where: { id: { in: demoCollections } },
  });
  await tx.friendship.deleteMany({
    where: {
      OR: [
        { userLow: { in: allUids } },
        { userHigh: { in: allUids } },
      ],
    },
  });

  await tx.user.deleteMany({
    where: {
      firebaseUid: {
        in: personaUids,
      },
    },
  });

  if (viewerUid === DEMO_VIEWER_DEFAULT.uid) {
    await tx.user.deleteMany({
      where: { firebaseUid: DEMO_VIEWER_DEFAULT.uid },
    });
  }

  await disableDemoSeedFlags(tx);
}

async function upsertUser(tx: SeedTx, user: DemoUserDef) {
  await withSeedRls(tx, user.uid, (scoped) =>
    scoped.user.upsert({
      where: { firebaseUid: user.uid },
      create: {
        firebaseUid: user.uid,
        displayName: user.displayName,
        avatarColor: user.avatarColor,
      },
      update: {
        displayName: user.displayName,
        avatarColor: user.avatarColor,
      },
    }),
  );
}

export async function seedDemo(prisma: PrismaClient): Promise<void> {
  const viewerUid = resolveViewerUid();
  const viewer = resolveViewerProfile(viewerUid);
  const personas = Object.values(DEMO_PERSONAS);

  console.log(`Seeding demo data (viewer=${viewerUid})…`);

  await prisma.$transaction(async (tx) => {
    await wipeDemoRows(tx, viewerUid);

    await upsertUser(tx, viewer);
    for (const persona of personas) {
      await upsertUser(tx, persona);
    }

    const friendships = [
      friendshipPair(viewerUid, DEMO_PERSONAS.ken.uid),
      friendshipPair(viewerUid, DEMO_PERSONAS.aoi.uid),
      friendshipPair(viewerUid, DEMO_PERSONAS.mika.uid),
      friendshipPair(DEMO_PERSONAS.ken.uid, DEMO_PERSONAS.aoi.uid),
    ];

    for (const pair of friendships.slice(0, 3)) {
      await withSeedRls(tx, viewerUid, (scoped) =>
        scoped.friendship.upsert({
          where: {
            userLow_userHigh: {
              userLow: pair.userLow,
              userHigh: pair.userHigh,
            },
          },
          create: {
            ...pair,
            status: "accepted",
            requestedBy: viewerUid,
            acceptedAt: new Date(),
          },
          update: {
            status: "accepted",
            acceptedAt: new Date(),
          },
        }),
      );
    }

    const kenAoi = friendshipPair(
      DEMO_PERSONAS.ken.uid,
      DEMO_PERSONAS.aoi.uid,
    );
    await withSeedRls(tx, DEMO_PERSONAS.ken.uid, (scoped) =>
      scoped.friendship.upsert({
        where: {
          userLow_userHigh: {
            userLow: kenAoi.userLow,
            userHigh: kenAoi.userHigh,
          },
        },
        create: {
          ...kenAoi,
          status: "accepted",
          requestedBy: DEMO_PERSONAS.ken.uid,
          acceptedAt: new Date(),
        },
        update: {
          status: "accepted",
          acceptedAt: new Date(),
        },
      }),
    );

    await withSeedRls(tx, DEMO_PERSONAS.ken.uid, (scoped) =>
      scoped.collection.createMany({
        data: [
          {
            id: DEMO_COLLECTION_IDS.kenIzakaya,
            ownerId: DEMO_PERSONAS.ken.uid,
            name: "中目黒サク飲み",
            description: "会社帰りにサッと入れる店",
            visibility: "friends",
            theme: "izakaya",
          },
          {
            id: DEMO_COLLECTION_IDS.kenOffice,
            ownerId: DEMO_PERSONAS.ken.uid,
            name: "会社帰りに一杯",
            description: "軽く飲める定番",
            visibility: "friends",
            theme: "casual",
          },
        ],
        skipDuplicates: true,
      }),
    );

    await withSeedRls(tx, DEMO_PERSONAS.aoi.uid, (scoped) =>
      scoped.collection.createMany({
        data: [
          {
            id: DEMO_COLLECTION_IDS.aoiQuiet,
            ownerId: DEMO_PERSONAS.aoi.uid,
            name: "静かな二人時間",
            description: "会話が途切れない店",
            visibility: "friends",
            theme: "date",
          },
          {
            id: DEMO_COLLECTION_IDS.aoiAnniversary,
            ownerId: DEMO_PERSONAS.aoi.uid,
            name: "記念日候補",
            description: "特別な日に",
            visibility: "secret",
            theme: "anniversary",
          },
        ],
        skipDuplicates: true,
      }),
    );

    await withSeedRls(tx, viewerUid, (scoped) =>
      scoped.collection.create({
        data: {
          id: DEMO_COLLECTION_IDS.viewerWishlist,
          ownerId: viewerUid,
          name: "行きたいリスト",
          description: "友達のおすすめから",
          visibility: "friends",
          theme: "wishlist",
        },
      }),
    );

    await withSeedRls(tx, DEMO_PERSONAS.mika.uid, (scoped) =>
      scoped.collection.create({
        data: {
          id: DEMO_COLLECTION_IDS.mikaCasual,
          ownerId: DEMO_PERSONAS.mika.uid,
          name: "今週行きたい",
          visibility: "friends",
          theme: "casual",
        },
      }),
    );

    await withSeedRls(tx, DEMO_PERSONAS.ken.uid, (scoped) =>
      scoped.spot.createMany({
        data: [
          {
            id: DEMO_SPOT_IDS.kenSharedIzakaya,
            placeId: DEMO_SHARED_PLACE_ID,
            addedBy: DEMO_PERSONAS.ken.uid,
            collectionId: DEMO_COLLECTION_IDS.kenIzakaya,
            comment: "半個室があって会社帰りに使いやすい",
            rating: Rating.again,
            tagArea: "中目黒",
            tagGenre: "居酒屋",
            tagSituation: "サク飲み",
            freeTags: ["半個室", "3人"],
          },
          {
            id: DEMO_SPOT_IDS.kenNakaCounter,
            placeId: "ChIJseedKenNakaCounter01",
            addedBy: DEMO_PERSONAS.ken.uid,
            collectionId: DEMO_COLLECTION_IDS.kenIzakaya,
            comment: "カウンターで一人でも入りやすい",
            rating: Rating.either,
            tagArea: "中目黒",
            tagGenre: "居酒屋",
            tagSituation: "サク飲み",
            freeTags: ["カウンター"],
          },
          {
            id: DEMO_SPOT_IDS.kenEbisuStanding,
            placeId: "ChIJseedKenEbisuStand01",
            addedBy: DEMO_PERSONAS.ken.uid,
            collectionId: DEMO_COLLECTION_IDS.kenIzakaya,
            comment: "立ち飲みでサクッと",
            rating: Rating.again,
            tagArea: "恵比寿",
            tagGenre: "立ち飲み",
            tagSituation: "サク飲み",
            freeTags: ["立ち飲み"],
          },
          {
            id: DEMO_SPOT_IDS.kenOfficeBistro,
            placeId: "ChIJseedKenOfficeBistro1",
            addedBy: DEMO_PERSONAS.ken.uid,
            collectionId: DEMO_COLLECTION_IDS.kenOffice,
            comment: "仕事終わりの一杯に",
            rating: Rating.again,
            tagArea: "恵比寿",
            tagGenre: "ビストロ",
            tagSituation: "会社帰り",
            freeTags: ["ワイン"],
          },
        ],
        skipDuplicates: true,
      }),
    );

    await withSeedRls(tx, DEMO_PERSONAS.aoi.uid, (scoped) =>
      scoped.spot.createMany({
        data: [
          {
            id: DEMO_SPOT_IDS.aoiSharedQuiet,
            placeId: DEMO_SHARED_PLACE_ID,
            addedBy: DEMO_PERSONAS.aoi.uid,
            collectionId: DEMO_COLLECTION_IDS.aoiQuiet,
            comment: "静かで会話が続く",
            rating: Rating.again,
            tagArea: "中目黒",
            tagGenre: "イタリアン",
            tagSituation: "デート",
            freeTags: ["静か", "2人"],
          },
          {
            id: DEMO_SPOT_IDS.aoiNakaWine,
            placeId: "ChIJseedAoiNakaWine001",
            addedBy: DEMO_PERSONAS.aoi.uid,
            collectionId: DEMO_COLLECTION_IDS.aoiQuiet,
            comment: "ワインが良くて落ち着く",
            rating: Rating.again,
            tagArea: "中目黒",
            tagGenre: "ワインバー",
            tagSituation: "じっくり",
            freeTags: ["ワイン"],
          },
          {
            id: DEMO_SPOT_IDS.aoiEbisuDate,
            placeId: "ChIJseedAoiEbisuDate01",
            addedBy: DEMO_PERSONAS.aoi.uid,
            collectionId: DEMO_COLLECTION_IDS.aoiQuiet,
            comment: "記念日前の下見に使った",
            rating: Rating.either,
            tagArea: "恵比寿",
            tagGenre: "フレンチ",
            tagSituation: "デート",
            freeTags: ["記念日"],
          },
          {
            id: DEMO_SPOT_IDS.aoiAnniversary,
            placeId: "ChIJseedAoiAnniversary1",
            addedBy: DEMO_PERSONAS.aoi.uid,
            collectionId: DEMO_COLLECTION_IDS.aoiAnniversary,
            comment: "記念日に使いたい",
            rating: Rating.again,
            tagArea: "恵比寿",
            tagGenre: "フレンチ",
            tagSituation: "記念日",
            freeTags: ["特別"],
          },
        ],
        skipDuplicates: true,
      }),
    );

    await withSeedRls(tx, DEMO_PERSONAS.mika.uid, (scoped) =>
      scoped.spot.create({
        data: {
          id: DEMO_SPOT_IDS.mikaSharedSpot,
          placeId: DEMO_SHARED_PLACE_ID,
          addedBy: DEMO_PERSONAS.mika.uid,
          collectionId: DEMO_COLLECTION_IDS.mikaCasual,
          comment: "友達と行ったあの店",
          rating: Rating.again,
          tagArea: "中目黒",
          tagGenre: "居酒屋",
          tagSituation: "サク飲み",
          freeTags: ["3人"],
        },
      }),
    );

    await withSeedRls(tx, viewerUid, (scoped) =>
      scoped.spot.create({
        data: {
          id: DEMO_SPOT_IDS.viewerRecoFromKen,
          placeId: DEMO_SHARED_PLACE_ID,
          addedBy: viewerUid,
          collectionId: DEMO_COLLECTION_IDS.viewerWishlist,
          comment: "Kenのおすすめを保存",
          rating: Rating.again,
          tagArea: "中目黒",
          tagGenre: "居酒屋",
          tagSituation: "サク飲み",
          originUserId: DEMO_PERSONAS.ken.uid,
          depth: 1,
        },
      }),
    );

    await withSeedRls(tx, viewerUid, (scoped) =>
      scoped.recollectionEdge.create({
        data: {
          id: DEMO_RECO_EDGE_IDS.viewerFromKen,
          spotId: DEMO_SPOT_IDS.viewerRecoFromKen,
          sourceSpotId: DEMO_SPOT_IDS.kenSharedIzakaya,
          actorId: viewerUid,
          originUserId: DEMO_PERSONAS.ken.uid,
          depth: 1,
        },
      }),
    );

    const mikaCopyId = DEMO_SPOT_IDS.mikaRecoFromAoi;
    await withSeedRls(tx, DEMO_PERSONAS.mika.uid, (scoped) =>
      scoped.spot.create({
        data: {
          id: mikaCopyId,
          placeId: DEMO_SHARED_PLACE_ID,
          addedBy: DEMO_PERSONAS.mika.uid,
          collectionId: DEMO_COLLECTION_IDS.mikaCasual,
          comment: "Aoiのおすすめを保存",
          rating: Rating.either,
          tagArea: "中目黒",
          tagGenre: "イタリアン",
          tagSituation: "デート",
          originUserId: DEMO_PERSONAS.aoi.uid,
          depth: 1,
        },
      }),
    );

    await withSeedRls(tx, DEMO_PERSONAS.mika.uid, (scoped) =>
      scoped.recollectionEdge.create({
        data: {
          id: DEMO_RECO_EDGE_IDS.mikaFromAoi,
          spotId: mikaCopyId,
          sourceSpotId: DEMO_SPOT_IDS.aoiSharedQuiet,
          actorId: DEMO_PERSONAS.mika.uid,
          originUserId: DEMO_PERSONAS.aoi.uid,
          depth: 1,
        },
      }),
    );

    const today = new Date();
    const validDate = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );

    await enableDemoSeedFlags(tx);
    await withSeedRls(tx, viewerUid, (scoped) =>
      scoped.dailyRecommendation.create({
        data: {
          id: DEMO_DAILY_RECO_ID,
          userId: viewerUid,
          spotId: DEMO_SPOT_IDS.kenSharedIzakaya,
          assertion: "今夜は中目黒のこの店がおすすめ",
          evidence: "Kenが『また行きたい』・輪で3人が保存",
          validDate,
        },
      }),
    );
    await disableDemoSeedFlags(tx);
  });

  console.log("PASS: demo seed completed");
  console.log(`  viewer: ${viewerUid}`);
  console.log(`  personas: ${personas.map((p) => p.uid).join(", ")}`);
  console.log(
    "  tip: SEED_VIEWER_UID=<your-firebase-uid> pnpm db:seed to link your account",
  );
}
