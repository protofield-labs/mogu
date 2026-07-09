"use client";

import Image from "next/image";

import { Button } from "@/components/ui/button";
import {
  PERSONA_INTRO_LEAD,
  PERSONA_INTRO_PROFILES,
  type PersonaIntroProfile,
} from "@/lib/agent/persona-intro";

type PersonaIntroCardProps = {
  onDismiss: () => void;
};

function PersonaRow({ profile }: { profile: PersonaIntroProfile }) {
  return (
    <li className="flex items-start gap-3">
      <Image
        src={profile.imageSrc}
        alt=""
        width={56}
        height={56}
        className="size-14 shrink-0 rounded-full object-cover ring-2 ring-background"
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">
          {profile.role} {profile.name}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {profile.blurb}
        </p>
        <p className="mt-1 text-caption text-muted-foreground">
          コレクション『{profile.collection}』
        </p>
      </div>
    </li>
  );
}

/** First-visit intro so Ken/Aoi are not mistaken for other users' sessions (#291). */
export function PersonaIntroCard({ onDismiss }: PersonaIntroCardProps) {
  return (
    <section
      className="rounded-2xl bg-mogu-surface-elevated px-4 py-4 shadow-mogu-card"
      aria-label="味覚アドバイザーの紹介"
    >
      <p className="text-sm font-semibold text-foreground">
        mogu の味覚アドバイザー
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        {PERSONA_INTRO_LEAD}
      </p>
      <ul className="mt-4 space-y-3">
        {PERSONA_INTRO_PROFILES.map((profile) => (
          <PersonaRow key={profile.key} profile={profile} />
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4 w-full"
        onClick={onDismiss}
      >
        わかった
      </Button>
    </section>
  );
}
