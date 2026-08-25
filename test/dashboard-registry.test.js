const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DASHBOARD_MODULE_KEYS,
  evaluateDashboardModules,
  getRuntimeModuleValidationErrors,
} = require("../src/modules/dashboard-registry");
const { getReactionRoleState } = require("../src/modules/reaction-roles");

test("reaction roles stay incomplete without a setup message id", () => {
  assert.equal(
    getReactionRoleState({
      reactionRolesChannelId: "123456789012345678",
      reactionRolesEnabled: true,
      reactionRolesMessageId: "",
      reactionRolesRoleId: "323456789012345678",
    }),
    "incomplete",
  );

  assert.equal(
    getReactionRoleState({
      reactionRolesChannelId: "123456789012345678",
      reactionRolesEnabled: true,
      reactionRolesMessageId: "223456789012345678",
      reactionRolesRoleId: "",
    }),
    "incomplete",
  );

  assert.equal(
    getReactionRoleState({
      reactionRolesChannelId: "123456789012345678",
      reactionRolesEnabled: true,
      reactionRolesMessageId: "223456789012345678",
      reactionRolesRoleId: "323456789012345678",
    }),
    "live",
  );
});

test("dashboard marks configured leveling and tickets modules live", () => {
  const modules = evaluateDashboardModules({
    settings: {
      aiToolsEnabled: true,
      levelingEnabled: true,
      levelingAnnounceChannelId: "123456789012345678",
      ticketsEnabled: true,
      ticketsIntakeChannelId: "223456789012345678",
    },
    channelOptions: [
      { id: "123456789012345678", label: "#levels" },
      { id: "223456789012345678", label: "#support" },
    ],
  });
  const byKey = Object.fromEntries(modules.map((module) => [module.key, module]));

  assert.equal(byKey.aiTools.state, "incomplete");
  assert.match(byKey.aiTools.blocker, /dedicated ai tools channel/i);
  assert.equal(byKey.leveling.state, "live");
  assert.equal(byKey.leveling.blocker, "");
  assert.equal(byKey.tickets.state, "live");
  assert.equal(byKey.tickets.blocker, "");
});

test("dashboard registry exposes every configured module in stable order", () => {
  const modules = evaluateDashboardModules({ settings: {} });

  assert.deepEqual(
    modules.map((module) => module.key),
    DASHBOARD_MODULE_KEYS,
  );
  assert.equal(new Set(DASHBOARD_MODULE_KEYS).size, DASHBOARD_MODULE_KEYS.length);
});

test("runtime validation only blocks modules with explicit runtime blockers", () => {
  const errors = getRuntimeModuleValidationErrors({
    aiToolsEnabled: true,
    levelingEnabled: true,
    ticketsEnabled: false,
  });

  assert.equal(errors.length, 0);
});
