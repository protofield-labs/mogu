const functions = require('@google-cloud/functions-framework');
const { evaluateNotification } = require('./dedupe');

/**
 * @param {number | string | undefined} value
 * @returns {string}
 */
function formatPercent(value) {
  if (value == null || value === '') {
    return '—';
  }

  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return String(value);
  }

  return `${Math.round(numeric * 1000) / 10}%`;
}

/**
 * @param {number | string | undefined} amount
 * @param {string} currencyCode
 * @returns {string}
 */
function formatMoney(amount, currencyCode) {
  if (amount == null || amount === '') {
    return '—';
  }

  const numeric = Number(amount);
  if (Number.isNaN(numeric)) {
    return String(amount);
  }

  try {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: currencyCode || 'JPY',
      maximumFractionDigits: 0,
    }).format(numeric);
  } catch {
    return `${numeric} ${currencyCode || 'JPY'}`;
  }
}

/**
 * @param {string | undefined} isoDate
 * @returns {string}
 */
function formatDate(isoDate) {
  if (!isoDate) {
    return '—';
  }

  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }

  return parsed.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * @param {Record<string, unknown>} payload
 * @param {Record<string, string>} attributes
 * @param {boolean} isTest
 * @returns {object[]}
 */
function buildBlocks(payload, attributes, isTest) {
  const actualThreshold = payload.alertThresholdExceeded;
  const forecastThreshold = payload.forecastThresholdExceeded;
  const currencyCode =
    typeof payload.currencyCode === 'string' ? payload.currencyCode : 'JPY';
  const budgetAmount = Number(payload.budgetAmount);
  const costAmount = Number(payload.costAmount);
  const usagePercent =
    Number.isFinite(budgetAmount) && budgetAmount > 0 && Number.isFinite(costAmount)
      ? `${Math.round((costAmount / budgetAmount) * 1000) / 10}%`
      : '—';

  let triggerLabel = 'Threshold exceeded';
  if (actualThreshold != null) {
    triggerLabel = `Actual spend ${formatPercent(actualThreshold)}`;
  } else if (forecastThreshold != null) {
    triggerLabel = `Forecast ${formatPercent(forecastThreshold)}`;
  }

  const headerText = isTest ? 'GCP Budget Alert (test)' : 'GCP Budget Alert';

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: headerText,
        emoji: false,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Budget*\n${payload.budgetDisplayName || '—'}`,
        },
        {
          type: 'mrkdwn',
          text: `*Trigger*\n${triggerLabel}`,
        },
        {
          type: 'mrkdwn',
          text: `*Current spend*\n${formatMoney(payload.costAmount, currencyCode)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Budget limit*\n${formatMoney(payload.budgetAmount, currencyCode)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Usage*\n${usagePercent}`,
        },
        {
          type: 'mrkdwn',
          text: `*Period start*\n${formatDate(
            typeof payload.costIntervalStart === 'string'
              ? payload.costIntervalStart
              : undefined,
          )}`,
        },
      ],
    },
    {
      type: 'divider',
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Billing account: \`${attributes.billingAccountId || '—'}\` · Budget ID: \`${attributes.budgetId || '—'}\``,
        },
      ],
    },
  ];
}

/**
 * @param {object[]} blocks
 * @returns {Promise<void>}
 */
async function postToSlack(blocks) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (webhookUrl) {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        blocks,
        text: 'GCP Budget Alert',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Slack webhook failed (${response.status}): ${body}`);
    }

    return;
  }

  const botToken = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL || '#mogu-lab';
  if (!botToken) {
    throw new Error('Neither SLACK_WEBHOOK_URL nor SLACK_BOT_TOKEN is configured');
  }

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${botToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      channel,
      blocks,
      text: 'GCP Budget Alert',
    }),
  });

  const body = await response.json();
  if (!body.ok) {
    throw new Error(`Slack API error: ${body.error || 'unknown'}`);
  }
}

/**
 * @param {import('@google-cloud/functions-framework').CloudEvent<{
 *   message: { data?: string; attributes?: Record<string, string> };
 * }>} cloudEvent
 */
functions.cloudEvent('notifySlack', async (cloudEvent) => {
  const message = cloudEvent.data?.message;
  if (!message?.data) {
    console.log('Pub/Sub message has no data payload; skipping');
    return;
  }

  const attributes = message.attributes || {};
  let payload;

  try {
    payload = JSON.parse(
      Buffer.from(message.data, 'base64').toString('utf8'),
    );
  } catch (error) {
    console.error('Invalid budget alert JSON; skipping:', error);
    return;
  }

  const isTest = attributes.testNotification === 'true';

  if (
    !isTest &&
    payload.alertThresholdExceeded == null &&
    payload.forecastThresholdExceeded == null
  ) {
    console.log('No budget threshold exceeded; skipping Slack notification');
    return;
  }

  let commitDedupeState = async () => {};
  if (!isTest) {
    const decision = await evaluateNotification(payload, attributes);
    if (!decision.notify) {
      return;
    }

    commitDedupeState = decision.commit;
  }

  const blocks = buildBlocks(payload, attributes, isTest);
  await postToSlack(blocks);
  // Record state only after the post succeeded: a Slack failure leaves the
  // message unacked and Pub/Sub retries it instead of dropping the alert.
  await commitDedupeState();
  console.log(
    isTest
      ? 'Posted test budget alert to Slack'
      : 'Posted budget threshold alert to Slack',
  );
});
