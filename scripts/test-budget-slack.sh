#!/usr/bin/env bash
# Publish a test budget alert to Pub/Sub (triggers the Slack notifier function).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_ID="${PROJECT_ID:-mogu-501309}"
TOPIC="${TOPIC:-dev-billing-budget-alerts}"

PAYLOAD=$(cat <<'EOF'
{"budgetDisplayName":"dev-monthly-budget","costAmount":650,"costIntervalStart":"2026-07-01T00:00:00Z","budgetAmount":3000,"budgetAmountType":"SPECIFIED_AMOUNT","alertThresholdExceeded":0.2,"currencyCode":"JPY"}
EOF
)

gcloud pubsub topics publish "$TOPIC" \
  --project="$PROJECT_ID" \
  --message="$PAYLOAD" \
  --attribute="billingAccountId=01F180-E9CD92-F8D826,budgetId=test-notification,schemaVersion=1.0,testNotification=true"

echo "Published test budget alert to ${TOPIC}. Check #mogu-lab in Slack."
