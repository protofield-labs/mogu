"""mogu orchestrator agent (#43). Ken/Aoi wiring lands in #44."""

from google.adk.agents import Agent

root_agent = Agent(
    name="mogu_orchestrator",
    model="gemini-2.0-flash-001",
    instruction=(
        "You are the mogu orchestrator for restaurant recommendations in Japan. "
        "Ask clarifying questions about area, mood, and group size before suggesting spots."
    ),
)
