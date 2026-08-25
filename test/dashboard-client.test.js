const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const { DASHBOARD_MODULE_KEYS } = require("../src/modules/dashboard-registry");

const dashboardClient = fs.readFileSync(
  path.join(__dirname, "..", "public", "app.js"),
  "utf8",
);

test("dashboard client diagnostics cover every server module", () => {
  for (const moduleKey of DASHBOARD_MODULE_KEYS) {
    const enabledField = `${moduleKey}Enabled`;
    const enablementPattern = moduleKey === "countdown"
      ? new RegExp(`enabled: isChecked\\("${escapeRegExp(enabledField)}"\\)`)
      : new RegExp(`const ${escapeRegExp(enabledField)} = isChecked\\("${escapeRegExp(enabledField)}"\\);`);
    assert.match(
      dashboardClient,
      enablementPattern,
      `${moduleKey} must participate in live enablement diagnostics`,
    );
    assert.match(
      dashboardClient,
      new RegExp(`\\n\\s+${escapeRegExp(moduleKey)}: \\{`),
      `${moduleKey} must have a live diagnostics state`,
    );
  }
});

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
