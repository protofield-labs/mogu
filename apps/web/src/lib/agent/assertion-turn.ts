const CLARIFYING_PATTERNS = [
  /[？?]\s*$/,
  /教えて(?:ください|く)?/,
  /どんな/,
  /どちら/,
  /どこ(?:に|が)/,
  /何人/,
  /何名/,
  /気分(?:は|が)/,
  /用途(?:は|が)/,
  /選(?:んで|び)/,
  /条件(?:は|を)/,
  /いかが/,
  /ですか/,
  /でしょうか/,
  /お聞かせ/,
];

/** Heuristic: agent reached an assertion turn (not a clarifying question). */
export function isAgentAssertionTurn(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 12) {
    return false;
  }
  if (CLARIFYING_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return false;
  }

  if (/断言/.test(trimmed)) {
    return true;
  }
  if (/おすすめ(?:です|！|。)?$/.test(trimmed)) {
    return true;
  }
  if (/こちら(?:の|が)?.*(?:おすすめ|行(?:く|って|こう))/.test(trimmed)) {
    return true;
  }
  if (/今夜(?:は|、).*(?:おすすめ|断言|ここ(?:が|を|は))/.test(trimmed)) {
    return true;
  }

  return false;
}
