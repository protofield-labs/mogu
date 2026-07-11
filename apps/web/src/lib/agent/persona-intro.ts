/** Persona intro onboarding for first-time agent chat (#291). */

import { AGENT_PERSONAS, type PersonaKey } from "@/lib/agent/persona-config";

export const PERSONA_INTRO_SEEN_KEY = "mogu:persona-intro-seen:v1";

export type PersonaIntroKey = PersonaKey;

export type PersonaIntroProfile = {
  key: PersonaIntroKey;
  name: string;
  role: string;
  blurb: string;
  collection: string;
  imageSrc: string;
};

export const PERSONA_INTRO_PROFILES: PersonaIntroProfile[] = AGENT_PERSONAS.map(
  (persona) => ({
    key: persona.key,
    name: persona.displayName,
    role: persona.role,
    blurb: persona.blurb,
    collection: persona.collectionName,
    imageSrc: persona.imageSrc,
  }),
);

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
  for (const persona of AGENT_PERSONAS) {
    if (message.includes(persona.displayName)) {
      return persona.imageSrc;
    }
  }
  return null;
}

/** Persona avatar image for agent bubbles (#312). */
export function personaImageForPersonaKey(key: PersonaIntroKey): string {
  return (
    AGENT_PERSONAS.find((profile) => profile.key === key)?.imageSrc ??
    `/personas/${key}.png`
  );
}
