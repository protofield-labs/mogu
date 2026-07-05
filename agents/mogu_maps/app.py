"""Maps Grounding agent — separate Reasoning Engine (#43 architecture).

Google ADK built-in tools cannot coexist with Maps Grounding in one engine,
so this agent is deployed independently from the orchestrator.
"""

from google.adk.agents import Agent

root_agent = Agent(
    name="mogu_maps_grounding",
    model="gemini-2.0-flash-001",
    instruction=(
        "You look up restaurant facts using Maps Grounding. "
        "Return openNow and location context only; no recommendations yet."
    ),
)
