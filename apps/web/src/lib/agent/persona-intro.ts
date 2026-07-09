/** Persona intro onboarding for first-time agent chat (#291). */

export const PERSONA_INTRO_SEEN_KEY = "mogu:persona-intro-seen:v1";

export type PersonaIntroKey = "ken" | "aoi";

export type PersonaIntroProfile = {
  key: PersonaIntroKey;
  name: string;
  role: string;
  blurb: string;
  collection: string;
  imageSrc: string;
};

export const PERSONA_INTRO_PROFILES: PersonaIntroProfile[] = [
  {
    key: "ken",
    name: "Ken",
    role: "サク飲み担当",
    blurb: "居酒屋・コスパ・友人との気軽な飲みに強い味覚アドバイザーです。",
    collection: "中目黒サク飲み",
    imageSrc: "/personas/ken.png",
  },
  {
    key: "aoi",
    name: "Aoi",
    role: "大人デート担当",
    blurb: "静かなお店・記念日・二人の時間に強い味覚アドバイザーです。",
    collection: "静かな二人時間",
    imageSrc: "/personas/aoi.png",
  },
];

export const PERSONA_INTRO_LEAD =
  "あなたの相談内容に合わせて、この2人の味覚を参照します。他人のチャットではなく、mogu 専用のデモ用アドバイザーです。";

export function hasSeenPersonaIntro(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    return window.localStorage.getItem(PERSONA_INTRO_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markPersonaIntroSeen(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(PERSONA_INTRO_SEEN_KEY, "1");
  } catch {
    // Ignore quota / private mode failures — card may reappear.
  }
}

export function resetPersonaIntroSeen(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(PERSONA_INTRO_SEEN_KEY);
  } catch {
    // ignore
  }
}

export function personaImageForThinkingMessage(
  message: string,
): string | null {
  if (message.includes("Ken")) {
    return "/personas/ken.png";
  }
  if (message.includes("Aoi")) {
    return "/personas/aoi.png";
  }
  return null;
}
