const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * "Today" as a JST calendar date (#42: 一推しは1日1枚).
 * Returned as a UTC-midnight Date so it maps cleanly onto the
 * `valid_date` @db.Date column. Both the nightly batch and
 * GET /home/recommendation must use this to avoid day boundary gaps.
 */
export function jstTodayDate(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + JST_OFFSET_MS);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ),
  );
}
