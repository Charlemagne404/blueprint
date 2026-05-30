const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeReactionRoleSettings, getReactionRoleState } = require("../src/modules/reaction-roles");
const { normalizeAntiRaidSettings, getAntiRaidState } = require("../src/modules/anti-raid");
const { normalizeAutomationSettings, getAutomationState } = require("../src/modules/automations");
const { normalizeModmailSettings, getModmailState } = require("../src/modules/modmail");
const { normalizeApplicationSettings, getApplicationState } = require("../src/modules/applications");

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
  assert.equal(settings.reactionRolesMaxPerMember, 5);
  assert.equal(getReactionRoleState(settings, [{ id: "123456789012345678", label: "#roles" }]), "live");
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
