/** Time-of-day greeting for the home screen title (#101). */
export function homePageTitle(now = new Date()): string {
  const hour = now.getHours();
  if (hour >= 18 || hour < 5) {
    return "こんばんは";
  }
  if (hour >= 11) {
    return "こんにちは";
  }
  return "おはよう";
}
