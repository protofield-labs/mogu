#!/usr/bin/env bash
set -euo pipefail

payload="$(cat)"
command_text="$(printf '%s' "${payload}" | jq -er '.command')"

terraform_command_pattern='(^|[[:space:]])terraform([[:space:]]|$)'
subcommand_deny_pattern='terraform([[:space:]]+-chdir=[^[:space:]]+)?[[:space:]]+(destroy|state|force-unlock|workspace)([[:space:]]|$)'
flag_deny_pattern='(^|[[:space:]])--?(target|destroy|replace)(=|[[:space:]]|$)'

if printf '%s' "${command_text}" | grep -Eq "${subcommand_deny_pattern}" ||
  {
    printf '%s' "${command_text}" | grep -Eq "${terraform_command_pattern}" &&
      printf '%s' "${command_text}" | grep -Eq "${flag_deny_pattern}"
  }; then
  deny_user_message='Blocked a dangerous Terraform command (destroy, state, force-unlock, workspace, or the -destroy/-replace/-target flags).'
  deny_agent_message='This Terraform command is denied by the harness. Do not run destroy, state, force-unlock, or workspace, and do not use the -destroy, -replace, -target, or --target flags. Use scripts/plan.sh to review changes instead.'
  jq -nc \
    --arg user_message "${deny_user_message}" \
    --arg agent_message "${deny_agent_message}" \
    '{permission: "deny", user_message: $user_message, agent_message: $agent_message}'
  exit 2
fi

printf '%s\n' '{"permission":"allow"}'
