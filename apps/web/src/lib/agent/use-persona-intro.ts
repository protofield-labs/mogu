"use client";

import { useSyncExternalStore } from "react";

import {
  hasSeenPersonaIntro,
  markPersonaIntroSeen,
  resetPersonaIntroSeen,
} from "@/lib/agent/persona-intro";

const PERSONA_INTRO_CHANGE_EVENT = "mogu:persona-intro-change";

function subscribePersonaIntro(onStoreChange: () => void) {
  window.addEventListener(PERSONA_INTRO_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(PERSONA_INTRO_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function notifyPersonaIntroChange() {
  window.dispatchEvent(new Event(PERSONA_INTRO_CHANGE_EVENT));
}

/** First-visit Ken/Aoi intro visibility (#291). */
export function usePersonaIntro() {
  const showPersonaIntro = useSyncExternalStore(
    subscribePersonaIntro,
    () => !hasSeenPersonaIntro(),
    () => false,
  );

  return {
    showPersonaIntro,
    dismissPersonaIntro: () => {
      markPersonaIntroSeen();
      notifyPersonaIntroChange();
    },
    showPersonaIntroAgain: () => {
      resetPersonaIntroSeen();
      notifyPersonaIntroChange();
    },
  };
}
