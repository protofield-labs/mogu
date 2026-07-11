import { DEMO_COLLECTION_IDS, DEMO_PERSONAS, DEMO_SPOT_IDS } from "@/lib/seed/demo-data";

/** Ken / Aoi demo taste advisors shared across agent, seed, and UI (#334). */
export type PersonaKey = "ken" | "aoi";

export type AgentPersonaConfig = {
  key: PersonaKey;
  displayName: string;
  role: string;
  collectionName: string;
  tagsSlash: string;
  tagsMiddleDot: string;
  blurb: string;
  thinkingLabel: string;
  tasteEvidence: string;
  imageSrc: string;
  ownerId: string;
  collectionId: string;
};

export const AGENT_PERSONAS: readonly AgentPersonaConfig[] = [
  {
    key: "ken",
    displayName: "Ken",
    role: "サク飲み担当",
    collectionName: "中目黒サク飲み",
    tagsSlash: "居酒屋 / コスパ / 友人",
    tagsMiddleDot: "居酒屋・コスパ・友人",
    blurb: "居酒屋・コスパ・友人との気軽な飲みに強い味覚アドバイザーです。",
    thinkingLabel: "サク飲み担当 Ken のコレクションを参照中…",
    tasteEvidence: "サク飲み担当 Kenの『中目黒サク飲み』寄り",
    imageSrc: "/personas/ken.png",
    ownerId: DEMO_PERSONAS.ken.uid,
    collectionId: DEMO_COLLECTION_IDS.kenIzakaya,
  },
  {
    key: "aoi",
    displayName: "Aoi",
    role: "大人デート担当",
    collectionName: "静かな二人時間",
    tagsSlash: "デート / 雰囲気 / 記念日",
    tagsMiddleDot: "デート・雰囲気・記念日",
    blurb: "静かなお店・記念日・二人の時間に強い味覚アドバイザーです。",
    thinkingLabel: "大人デート担当 Aoi のコレクションを参照中…",
    tasteEvidence: "大人デート担当 Aoiの『静かな二人時間』寄り",
    imageSrc: "/personas/aoi.png",
    ownerId: DEMO_PERSONAS.aoi.uid,
    collectionId: DEMO_COLLECTION_IDS.aoiQuiet,
  },
] as const;

export const AGENT_PERSONA_BY_KEY: Record<PersonaKey, AgentPersonaConfig> =
  Object.fromEntries(AGENT_PERSONAS.map((persona) => [persona.key, persona])) as Record<
    PersonaKey,
    AgentPersonaConfig
  >;

/** Demo seed spot UUID prefix — aligned with demo_seed_policy migration. */
export const DEMO_PERSONA_SPOT_ID_PREFIX = "22222222-2222-4222-8222-";

/** Core persona spots excluded from weekly rotation (#318). */
export const PERSONA_CORE_SPOT_IDS: Readonly<Record<PersonaKey, string>> = {
  ken: DEMO_SPOT_IDS.kenSharedIzakaya,
  aoi: DEMO_SPOT_IDS.aoiSharedQuiet,
} as const;

export function isPersonaCoreSpotId(spotId: string): boolean {
  return Object.values(PERSONA_CORE_SPOT_IDS).includes(spotId);
}

export type PersonaCollectionHint = {
  collection: string;
  evidence: string;
  demoUid: string;
  role: string;
};

export function buildPersonaThinkingRecord(): Record<PersonaKey, string> {
  return Object.fromEntries(
    AGENT_PERSONAS.map((persona) => [persona.key, persona.thinkingLabel]),
  ) as Record<PersonaKey, string>;
}

export function buildPersonaCollectionHintsRecord(): Record<
  PersonaKey,
  PersonaCollectionHint
> {
  return Object.fromEntries(
    AGENT_PERSONAS.map((persona) => [
      persona.key,
      {
        collection: persona.collectionName,
        evidence: persona.tasteEvidence,
        demoUid: persona.ownerId,
        role: persona.role,
      },
    ]),
  ) as Record<PersonaKey, PersonaCollectionHint>;
}

export function personaCollectionNames(): string[] {
  return AGENT_PERSONAS.map((persona) => persona.collectionName);
}

/** Internal persona "参照:" lines must not reach the user bubble (#270). */
export function buildPersonaReferenceLinePattern(): RegExp {
  const collectionNames = personaCollectionNames().join("|");
  return new RegExp(
    `^\\s*参照\\s*[:：].*(?:コレクション|Ken|Aoi|ケン|アオイ|${collectionNames})`,
    "i",
  );
}

/**
 * When unset or truthy, Ken/Aoi demo prefetch and demo-viewer RLS fallback stay enabled.
 * Set AGENT_DEMO_MODE=0|false|off|no to disable demo-only runtime paths (#334).
 */
export function isAgentDemoMode(): boolean {
  const raw = process.env.AGENT_DEMO_MODE?.trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off" && raw !== "no";
}

export function isPersonaKey(value: string): value is PersonaKey {
  return value in AGENT_PERSONA_BY_KEY;
}
