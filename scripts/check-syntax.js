"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const roots = ["src", "test", "scripts", "public"];
const files = [];

function collectJavaScriptFiles(directory) {
  if (!fs.existsSync(directory)) {
    return;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectJavaScriptFiles(entryPath);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(entryPath);
    }
  }
}

for (const root of roots) {
  collectJavaScriptFiles(root);
}

files.sort();

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log(`JavaScript syntax check passed for ${files.length} files.`);
