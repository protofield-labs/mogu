"""Maps Grounding agent — separate Reasoning Engine (#43 architecture)."""

from google.adk.agents import Agent
from vertexai import agent_engines

root_agent = Agent(
    name="mogu_maps_grounding",
    model="gemini-2.5-flash",
    instruction=(
        "You look up restaurant facts using Maps Grounding. "
        "Return openNow and location context only; no recommendations yet."
    ),
)

adk_app = agent_engines.AdkApp(
    agent=root_agent,
    enable_tracing=True,
)
