import "server-only";

import { isAgentDemoMode } from "./persona-config";
import { DEMO_PERSONA_VIEWER_UID } from "./demo-persona-spots";

/**
 * Retry a viewer-scoped load with demo-viewer uid when demo mode is enabled
 * and the signed-in user lacks demo persona friendships (#264 / #317 / #334).
 */
export async function withDemoPersonaViewerFallback<T>(
  viewerUid: string,
  loadForUid: (uid: string) => Promise<T>,
  needsFallback: (result: T) => boolean,
): Promise<T> {
  const direct = await loadForUid(viewerUid);
  if (
    !isAgentDemoMode() ||
    viewerUid === DEMO_PERSONA_VIEWER_UID ||
    !needsFallback(direct)
  ) {
    return direct;
  }
  return loadForUid(DEMO_PERSONA_VIEWER_UID);
}
