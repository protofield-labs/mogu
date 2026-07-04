const { Storage } = require('@google-cloud/storage');

const storage = new Storage();

/**
 * @param {string} value
 * @returns {string}
 */
function sanitizePathSegment(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * @param {number | string | null | undefined} value
 * @returns {number | null}
 */
function toThreshold(value) {
  if (value == null || value === '') {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * @param {Record<string, unknown>} payload
 * @param {Record<string, string>} attributes
 * @returns {{ budgetId: string, periodStart: string, actual: number | null, forecast: number | null }}
 */
function extractThresholds(payload, attributes) {
  const budgetId = attributes.budgetId || 'unknown-budget';
  const periodStart =
    typeof payload.costIntervalStart === 'string'
      ? payload.costIntervalStart
      : 'unknown-period';

  return {
    budgetId,
    periodStart,
    actual: toThreshold(payload.alertThresholdExceeded),
    forecast: toThreshold(payload.forecastThresholdExceeded),
  };
}

/**
 * @param {string} budgetId
 * @param {string} periodStart
 * @returns {Promise<{ actual: number | null, forecast: number | null }>}
 */
async function loadState(budgetId, periodStart) {
  const bucketName = process.env.DEDUPE_BUCKET;
  if (!bucketName) {
    throw new Error('DEDUPE_BUCKET is not configured');
  }

  const prefix = process.env.DEDUPE_PREFIX || 'budget-slack-dedupe';
  const objectPath = `${prefix}/${sanitizePathSegment(budgetId)}/${sanitizePathSegment(periodStart)}.json`;
  const file = storage.bucket(bucketName).file(objectPath);

  try {
    const [contents] = await file.download();
    const parsed = JSON.parse(contents.toString('utf8'));
    return {
      actual: toThreshold(parsed.actual),
      forecast: toThreshold(parsed.forecast),
    };
  } catch (error) {
    if (error.code === 404) {
      return { actual: null, forecast: null };
    }

    throw error;
  }
}

/**
 * @param {string} budgetId
 * @param {string} periodStart
 * @param {{ actual: number | null, forecast: number | null }} state
 * @returns {Promise<void>}
 */
async function saveState(budgetId, periodStart, state) {
  const bucketName = process.env.DEDUPE_BUCKET;
  if (!bucketName) {
    throw new Error('DEDUPE_BUCKET is not configured');
  }

  const prefix = process.env.DEDUPE_PREFIX || 'budget-slack-dedupe';
  const objectPath = `${prefix}/${sanitizePathSegment(budgetId)}/${sanitizePathSegment(periodStart)}.json`;
  const file = storage.bucket(bucketName).file(objectPath);

  await file.save(
    JSON.stringify({
      actual: state.actual,
      forecast: state.forecast,
    }),
    {
      contentType: 'application/json',
      metadata: {
        cacheControl: 'no-cache',
      },
    },
  );
}

/**
 * Decide whether a threshold newly exceeds the highest one already sent for
 * this budget period (stops duplicate Slack posts on periodic Pub/Sub).
 *
 * State is committed by the caller AFTER the Slack post succeeds, so a failed
 * post is retried instead of being recorded as notified (prefer a rare
 * duplicate over a lost cost alert).
 *
 * @param {Record<string, unknown>} payload
 * @param {Record<string, string>} attributes
 * @returns {Promise<{ notify: boolean, commit: () => Promise<void> }>}
 */
async function evaluateNotification(payload, attributes) {
  const { budgetId, periodStart, actual, forecast } = extractThresholds(
    payload,
    attributes,
  );

  const skip = { notify: false, commit: async () => {} };

  if (actual == null && forecast == null) {
    return skip;
  }

  const state = await loadState(budgetId, periodStart);
  let changed = false;

  if (actual != null && (state.actual == null || actual > state.actual)) {
    state.actual = actual;
    changed = true;
  }

  if (forecast != null && (state.forecast == null || forecast > state.forecast)) {
    state.forecast = forecast;
    changed = true;
  }

  if (!changed) {
    console.log(
      `Threshold already notified for budget=${budgetId} period=${periodStart}; skipping`,
    );
    return skip;
  }

  return {
    notify: true,
    commit: () => saveState(budgetId, periodStart, state),
  };
}

module.exports = {
  evaluateNotification,
};
