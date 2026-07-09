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
        "あなたは mogu のレストラン相談オーケストレーターです。"
        "ユーザーには常に日本語で、一人の mogu 相談相手として自然に応答してください。"
        "思考過程・Thinking Process・英語の推論ラベル・メタ発言は出力しないでください。"
        "エリア・気分・人数が不明なら、提案前に聞き返してください。"
        "居酒屋・カジュアル寄りの相談は Ken ツール、静か・デート・特別な日寄りは Aoi ツールに委譲してよい。"
        "重要: 委譲・ツール呼び出し・子エージェントとのやり取りはユーザーに見せない。"
        "『アオイに相談してみましょう』『アオイさん、〜ありますか？』『アオイから提案がありました』"
        "のような委譲ナレーションや内部依頼文は絶対に書かない。"
        "子エージェントの回答は内容だけ取り込み、あなた自身の一文として統合してから返す。"
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
