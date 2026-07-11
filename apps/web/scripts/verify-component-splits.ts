/**
 * Large component split verification (#113 / #336 / #338).
 * Run via: pnpm exec tsx scripts/verify-component-splits.ts
 */
import { assertExportedFunction } from "./test-helpers/module-exports";
import { installServerOnlyMock } from "./test-helpers/mock-server-only";

import * as agentChatBubbles from "../src/components/search/agent-chat-bubbles";
import * as agentChat from "../src/components/search/agent-chat";
import * as collectionFormFields from "../src/components/mypage/collection-form-fields";
import * as spotList from "../src/components/mypage/spot-list";
import * as replySanitizer from "../src/lib/agent/reply-sanitizer";
import * as useAgentChat from "../src/lib/agent/use-agent-chat";
import * as useAgentSend from "../src/lib/agent/use-agent-send";
import * as useAgentSession from "../src/lib/agent/use-agent-session";
import * as useConnectGeneration from "../src/lib/agent/use-connect-generation";
import * as useConsultationHistory from "../src/lib/agent/use-consultation-history";
import * as useFriendSearch from "../src/lib/mypage/use-friend-search";
import * as useFriendsView from "../src/lib/mypage/use-friends-view";
import * as useMypageCollections from "../src/lib/mypage/use-mypage-collections";

async function main() {
  assertExportedFunction(spotList, "SpotList", "spot list extracted");
  assertExportedFunction(useFriendsView, "useFriendsView", "friends hook extracted");
  assertExportedFunction(useFriendSearch, "useFriendSearch", "friend search hook extracted");
  assertExportedFunction(
    useMypageCollections,
    "useMypageCollections",
    "mypage collections hook",
  );
  assertExportedFunction(agentChat, "AgentChat", "agent chat shell exported");
  assertExportedFunction(useAgentChat, "useAgentChat", "agent chat hook extracted");
  assertExportedFunction(useAgentSession, "useAgentSession", "agent session hook extracted");
  assertExportedFunction(useAgentSend, "useAgentSend", "agent send hook extracted");
  assertExportedFunction(
    useConsultationHistory,
    "useConsultationHistory",
    "consultation history hook extracted",
  );
  assertExportedFunction(
    useConnectGeneration,
    "useConnectGeneration",
    "connect generation hook exported",
  );
  assertExportedFunction(
    replySanitizer,
    "stripLeakedThinkingText",
    "reply sanitizer extracted",
  );
  assertExportedFunction(agentChatBubbles, "AgentBubble", "agent bubbles extracted");
  assertExportedFunction(
    collectionFormFields,
    "CollectionFormFields",
    "collection form fields extracted",
  );

  installServerOnlyMock();
  const [agentStreamQuery, resolveAgentTurn] = await Promise.all([
    import("../src/lib/agent/agent-stream-query"),
    import("../src/lib/agent/resolve-agent-turn"),
  ]);
  assertExportedFunction(
    resolveAgentTurn,
    "resolveAgentTurnRoute",
    "agent turn route resolver extracted",
  );
  assertExportedFunction(
    agentStreamQuery,
    "executeAgentStreamQuery",
    "agent stream query extracted",
  );

  console.log("PASS: component splits verified");
}

void main();
