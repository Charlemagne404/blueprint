const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getReactionRoleState,
  normalizeReactionRoleSettings,
  validateReactionRoleSettings,
} = require("../src/modules/reaction-roles");
const { normalizeAntiRaidSettings, getAntiRaidState } = require("../src/modules/anti-raid");
const {
  getAutomationState,
  normalizeAutomationSettings,
  validateAutomationSettings,
} = require("../src/modules/automations");
const { normalizeModmailSettings, getModmailState } = require("../src/modules/modmail");
const {
  getApplicationPrompts,
  normalizeApplicationSettings,
  getApplicationState,
  validateApplicationSettings,
} = require("../src/modules/applications");

test("reaction roles normalize and require complete setup", () => {
  const settings = normalizeReactionRoleSettings({
    reactionRolesEnabled: "on",
    reactionRolesChannelId: "123456789012345678",
    reactionRolesMessageId: "123456789012345679",
    reactionRolesRoleId: "123456789012345680",
    reactionRolesEmoji: "✅",
    reactionRolesMaxPerMember: "5",
  });

  assert.equal(settings.reactionRolesEnabled, true);
  assert.equal(settings.reactionRolesMaxPerMember, 1);
  assert.equal(getReactionRoleState(settings, [{ id: "123456789012345678", label: "#roles" }]), "live");
});

test("reaction roles require a role Blueprint can manage", () => {
  const settings = normalizeReactionRoleSettings({
    reactionRolesEnabled: "on",
    reactionRolesChannelId: "123456789012345678",
    reactionRolesMessageId: "123456789012345679",
    reactionRolesRoleId: "123456789012345680",
  });
  const guild = { id: "123456789012345670", channels: { cache: new Map() }, roles: { cache: new Map() } };
  const role = { guild, id: settings.reactionRolesRoleId, managed: false };
  guild.channels.cache.set(settings.reactionRolesChannelId, {});
  guild.roles.cache.set(role.id, role);

  assert.match(validateReactionRoleSettings(settings, guild)[0], /Manage Roles/i);

  const botMember = {
    permissions: { has: () => true },
    roles: { highest: { comparePositionTo: () => 1 } },
  };
  assert.deepEqual(validateReactionRoleSettings(settings, guild, botMember), []);
});

test("anti-raid state stays incomplete without alert channel", () => {
  const settings = normalizeAntiRaidSettings({ antiRaidEnabled: "on" });
  assert.equal(getAntiRaidState(settings), "incomplete");
});

test("automations keyword trigger requires phrase", () => {
  const settings = normalizeAutomationSettings({
    automationsEnabled: "on",
    automationsLogChannelId: "123456789012345678",
    automationsTrigger: "keyword",
    automationsKeyword: "",
  });

  assert.equal(getAutomationState(settings, [{ id: "123456789012345678", label: "#ops" }]), "incomplete");
});

test("automation ticket actions require the ticket module", () => {
  const settings = normalizeAutomationSettings({
    automationsEnabled: "on",
    automationsLogChannelId: "123456789012345678",
    automationsAction: "create_ticket",
  });
  settings.ticketsEnabled = false;
  settings.ticketsIntakeChannelId = "223456789012345678";

  assert.equal(
    getAutomationState(settings, [
      { id: "123456789012345678", label: "#ops" },
      { id: "223456789012345678", label: "#tickets" },
    ]),
    "incomplete",
  );

  settings.ticketsEnabled = true;
  const guild = {
    channels: {
      cache: new Map([
        ["123456789012345678", { id: "123456789012345678" }],
        ["223456789012345678", { id: "223456789012345678" }],
      ]),
    },
    roles: { cache: new Map() },
  };
  assert.deepEqual(validateAutomationSettings(settings, guild), []);
});

test("modmail and applications states become live when channel/role exist", () => {
  const channels = [{ id: "123456789012345678", label: "#staff" }];
  const roles = [{ id: "123456789012345679", label: "Support" }];

  const modmail = normalizeModmailSettings({
    modmailEnabled: "on",
    modmailInboxChannelId: "123456789012345678",
    modmailStaffRoleId: "123456789012345679",
  });
  assert.equal(getModmailState(modmail, channels, roles), "live");

  const applications = normalizeApplicationSettings({
    applicationsEnabled: "on",
    applicationsChannelId: "123456789012345678",
    applicationsReviewerRoleId: "123456789012345679",
    applicationsFormTitle: "Mod App",
  });
  assert.equal(getApplicationState(applications, channels, roles), "live");
});

test("applications prompts preserve configured order and enforce modal limits", () => {
  const settings = normalizeApplicationSettings({
    applicationsEnabled: "on",
    applicationsChannelId: "123456789012345678",
    applicationsReviewerRoleId: "123456789012345679",
    applicationsQuestions: "Why do you want to help?\nWhat timezone are you in?\nHow active are you?",
  });

  assert.deepEqual(getApplicationPrompts(settings), [
    "Why do you want to help?",
    "What timezone are you in?",
    "How active are you?",
  ]);

  const guild = {
    channels: { cache: new Map([["123456789012345678", {}]]) },
    roles: { cache: new Map([["123456789012345679", {}]]) },
  };
  assert.deepEqual(validateApplicationSettings(settings, guild), []);

  const tooManyPrompts = normalizeApplicationSettings({
    applicationsEnabled: "on",
    applicationsChannelId: "123456789012345678",
    applicationsReviewerRoleId: "123456789012345679",
    applicationsQuestions: "1\n2\n3\n4\n5\n6",
  });
  assert.match(
    validateApplicationSettings(tooManyPrompts, guild)[0],
    /up to 5 prompts/i,
  );
});
