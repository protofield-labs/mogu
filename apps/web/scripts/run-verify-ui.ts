/**
 * Run UI/unit verify scripts that do not require DATABASE_URL (#114).
 */
import { spawnSync } from "node:child_process";

const scripts = [
  "verify-auth-errors.ts",
  "verify-api-error-labels.ts",
  "verify-design-tokens.ts",
  "verify-pwa-manifest.ts",
  "verify-spot-dto.ts",
  "verify-browser-client.ts",
  "verify-api-routes.ts",
  "verify-dead-code.ts",
  "verify-ui-primitives.ts",
  "verify-agent-config.ts",
  "verify-agent-message.ts",
  "verify-agent-events.ts",
  "verify-agent-event-relay.ts",
  "verify-agent-chat.ts",
  "verify-agent-consultations.ts",
  "verify-mypage-ui.ts",
  "verify-friend-profile.ts",
  "verify-deeplink-share.ts",
  "verify-map-view.ts",
  "verify-all-my-spots.ts",
  "verify-map-geolocation.ts",
  "verify-map-load-error.ts",
  "verify-branding-ui.ts",
  "verify-places-photos.ts",
  "verify-agent-recommendation.ts",
  "verify-recollect.ts",
  "verify-component-splits.ts",
  "verify-photo-url.ts",
  "verify-feed-helpers.ts",
  "verify-home-ui.ts",
  "verify-touch-feedback.ts",
];

for (const script of scripts) {
  console.log(`==> ${script}`);
  const result = spawnSync("pnpm", ["exec", "tsx", `scripts/${script}`], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("PASS: all UI verify scripts completed");
