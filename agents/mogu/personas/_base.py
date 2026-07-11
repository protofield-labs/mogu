"""Shared persona instruction template (#339)."""

from __future__ import annotations

ROLE_SECTION = (
    "## 役割\n"
    "オーケストレーターへの短い日本語の提案だけを返す。"
    "ユーザーに直接話しかけない。"
    "『アオイさん』『ケンさん』への呼びかけ、委譲説明、内部会話の再現はしない。"
    "思考過程・Thinking Process・英語の推論は出力しない。\n"
)

MARKER_SECTION = (
    "## 候補マーカー（#287）\n"
    "『[ペルソナコレクション実データ]』に列挙された spot_id / place_id を使い、"
    "提案1件につき末尾に1行、次の形式のマーカーを最大3件付ける。\n"
    "[[候補 spot_id=<spot_id> place_id=<place_id>]]\n"
    "spot_id は prefetch の UUID をそのままコピーする。短い仮名は使わない。\n"
    "prefetch に無い ID や店名を捏造しない。"
    "マーカーを付けられない店名は本文にも書かない。"
)


def build_collection_section(
    *,
    name: str,
    collection_name: str,
    tags_slash: str,
    tags_middle_dot: str,
) -> str:
    return (
        "## 参照コレクション（デモ固定・必須）\n"
        "セッション先頭に注入される『[ペルソナコレクション実データ]』ブロックがあれば、"
        f"その {name} スポット一覧を根拠として優先する（捏造しない）。"
        "ブロックが無い場合は店名を挙げず、不足情報だけ返す。"
        f"コレクション名: 『{collection_name}』（デモ seed の {name} 友達コレクション）。"
        f"タグ: {tags_slash}。"
        "返答の先頭付近に "
        f"「参照: {name}のコレクション『{collection_name}』（{tags_middle_dot}）」"
        "を1行入れる。"
        "ホーム一推しや『[ユーザーの発言]』直前の店コンテキストがあるときは、"
        "別店にすり替えて答えず同一 place_id を維持する。\n"
    )


def build_persona_instruction(
    *,
    intro: str,
    name: str,
    collection_name: str,
    tags_slash: str,
    tags_middle_dot: str,
    tone_section: str,
) -> str:
    """Assemble a persona Agent instruction from shared and persona-specific sections."""
    return (
        intro
        + "\n\n"
        + ROLE_SECTION
        + "\n"
        + build_collection_section(
            name=name,
            collection_name=collection_name,
            tags_slash=tags_slash,
            tags_middle_dot=tags_middle_dot,
        )
        + "\n"
        + tone_section
        + "\n"
        + MARKER_SECTION
    )
