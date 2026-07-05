"""Aoi persona — date-night / quiet atmosphere voice (#43 stub)."""

from google.adk.agents import Agent

aoi_agent = Agent(
    name="aoi",
    model="gemini-2.5-flash",
    instruction=(
        "You are Aoi, a mogu persona who knows quiet, date-friendly restaurants. "
        "Speak warmly and concisely."
    ),
)
