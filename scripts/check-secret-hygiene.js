"use strict";

const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const result = spawnSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
  { encoding: "buffer" },
);
if (result.status !== 0) {
  console.error("Secret hygiene check requires a Git worktree.");
  process.exit(result.status || 1);
}

const files = result.stdout
  .toString("utf8")
  .split("\0")
  .filter(Boolean);
const findings = [];
const highConfidencePatterns = [
  { label: "private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { label: "credentialed URL", pattern: /https?:\/\/[^\s/@:]+:[^\s/@]+@/i },
  { label: "GitHub token", pattern: /\b(?:ghp|github_pat)_[A-Za-z0-9_]+\b/ },
  { label: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { label: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
];
const environmentAssignment =
  /\b(?:DISCORD_TOKEN|DISCORD_SESSION_SECRET|VANGUARD_BACKEND_API_KEY|AUTH_API_KEY|API_KEY|ACCESS_TOKEN)[ \t]*[:=][ \t]*["']?([^\s"']{16,})/gi;

for (const file of files) {
  let content;
  try {
    content = fs.readFileSync(file);
  } catch {
    continue;
  }

  if (content.includes(0) || content.byteLength > 2 * 1024 * 1024) {
    continue;
  }

  const text = content.toString("utf8");
  for (const { label, pattern } of highConfidencePatterns) {
    if (pattern.test(text)) {
      findings.push(`${file}: ${label}`);
    }
    pattern.lastIndex = 0;
  }

  for (const match of text.matchAll(environmentAssignment)) {
    const value = String(match[1] || "").toLowerCase();
    if (!isPlaceholder(value)) {
      findings.push(`${file}: non-placeholder environment secret assignment`);
    }
  }
}

if (findings.length > 0) {
  console.error("Potential secrets found in tracked files:");
  for (const finding of [...new Set(findings)]) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log(`Secret hygiene check passed for ${files.length} tracked/non-ignored files.`);

function isPlaceholder(value) {
  return [
    "test",
    "example",
    "placeholder",
    "change-me",
    "changeme",
    "blueprint-test",
    "ci-placeholder",
  ].some((marker) => value.includes(marker));
}
