#!/usr/bin/env node
/**
 * Post or update a PR comment with the sanitized Terraform plan summary (#21).
 * Reads JSON from PLAN_SUMMARY_FILE (same shape as scripts/plan.sh output).
 */
import fs from "node:fs";

const summaryPath = process.env.PLAN_SUMMARY_FILE;
const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const prNumber = process.env.PR_NUMBER;
const marker = "<!-- terraform-plan-summary -->";

if (!summaryPath || !token || !repo || !prNumber) {
  console.error("Missing PLAN_SUMMARY_FILE, GITHUB_TOKEN, GITHUB_REPOSITORY, or PR_NUMBER");
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
const { create, update, replace, delete: del } = summary.summary;

const lines = summary.resource_changes.map((change) => {
  const actions = change.actions.join(", ");
  return `- \`${change.address}\` (${change.type}): ${actions}`;
});

const body = [
  marker,
  "## Terraform plan summary",
  "",
  "| Action | Count |",
  "|--------|------:|",
  `| create | ${create} |`,
  `| update | ${update} |`,
  `| delete | ${del} |`,
  `| replace | ${replace} |`,
  "",
  lines.length > 0 ? "### Resource changes" : "_No resource changes._",
  ...lines,
  "",
  "Sanitized summary only (no attribute values). `PLAN_STRICT=true` fails on delete/replace.",
].join("\n");

const [owner, name] = repo.split("/");
const api = (path, options = {}) =>
  fetch(`https://api.github.com/repos/${owner}/${name}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers ?? {}),
    },
  });

async function main() {
  const listRes = await api(
    `/issues/${prNumber}/comments?per_page=100`,
  );
  if (!listRes.ok) {
    throw new Error(`Failed to list comments: ${listRes.status} ${await listRes.text()}`);
  }

  const comments = await listRes.json();
  const existing = comments.find((comment) => comment.body?.includes(marker));

  if (existing) {
    const updateRes = await api(`/issues/comments/${existing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!updateRes.ok) {
      throw new Error(`Failed to update comment: ${updateRes.status} ${await updateRes.text()}`);
    }
    return;
  }

  const createRes = await api(`/issues/${prNumber}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!createRes.ok) {
    throw new Error(`Failed to create comment: ${createRes.status} ${await createRes.text()}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
