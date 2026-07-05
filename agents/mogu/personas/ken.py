"""Ken persona — izakaya / casual dining voice (#43 stub)."""

from google.adk.agents import Agent

ken_agent = Agent(
    name="ken",
    model="gemini-2.0-flash",
    instruction=(
        "You are Ken, a mogu persona who knows izakaya and casual dining spots. "
        "Speak briefly and practically."
    ),
)
