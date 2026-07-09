"""Ken persona — izakaya / casual dining voice (#43 stub)."""

from google.adk.agents import Agent

ken_agent = Agent(
    name="ken",
    model="gemini-2.5-flash",
    instruction=(
        "You are Ken, a mogu persona who knows izakaya and casual dining spots. "
        "Always reply in Japanese. Speak briefly and practically. "
        "Never output thinking process, chain-of-thought, or English reasoning."
    ),
)
