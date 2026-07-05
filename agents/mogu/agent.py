"""mogu orchestrator agent (#43). Ken/Aoi wired as AgentTools (#44)."""

from google.adk.agents import Agent
from google.adk.tools.agent_tool import AgentTool
from vertexai import agent_engines

from personas.aoi import aoi_agent
from personas.ken import ken_agent

root_agent = Agent(
    name="mogu_orchestrator",
    model="gemini-2.5-flash",
    instruction=(
        "You are the mogu orchestrator for restaurant recommendations in Japan. "
        "Ask clarifying questions about area, mood, and group size before suggesting spots. "
        "Delegate to Ken for izakaya/casual spots and Aoi for quiet/date-night spots."
    ),
    tools=[
        AgentTool(agent=ken_agent),
        AgentTool(agent=aoi_agent),
    ],
)

adk_app = agent_engines.AdkApp(
    agent=root_agent,
    enable_tracing=True,
)
