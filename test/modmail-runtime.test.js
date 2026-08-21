const test = require("node:test");
const assert = require("node:assert/strict");
const { PermissionFlagsBits, PermissionsBitField } = require("discord.js");

const {
  canStaffReplyToModmail,
  getModmailReferenceId,
  getModmailReplyContent,
} = require("../src/modules/modmail-runtime");

test("modmail runtime reads Discord reply references", () => {
  assert.equal(getModmailReferenceId({ reference: { messageId: "inbox-1" } }), "inbox-1");
  assert.equal(getModmailReferenceId({ reference: { message_id: "inbox-2" } }), "inbox-2");
  assert.equal(getModmailReferenceId({}), "");
});

test("modmail staff replies require the configured inbox and staff access", () => {
  const settings = {
    modmailEnabled: true,
    modmailInboxChannelId: "inbox",
    modmailStaffRoleId: "staff",
  };
  const mapping = { guildId: "guild", userId: "member" };
  const baseMessage = {
    author: { bot: false },
    channelId: "inbox",
    guild: { id: "guild" },
    member: {
      permissions: new PermissionsBitField(),
      roles: { cache: new Set(["staff"]) },
    },
  };

  assert.equal(canStaffReplyToModmail(baseMessage, settings, mapping), true);
  assert.equal(
    canStaffReplyToModmail(
      {
        ...baseMessage,
        channelId: "other-channel",
      },
      settings,
      mapping,
    ),
    false,
  );
  assert.equal(
    canStaffReplyToModmail(
      {
        ...baseMessage,
        member: {
          permissions: new PermissionsBitField([PermissionFlagsBits.ViewChannel]),
          roles: { cache: new Set() },
        },
      },
      settings,
      mapping,
    ),
    false,
  );
});

test("modmail reply text is bounded and ignores empty messages", () => {
  assert.equal(getModmailReplyContent({ content: "   " }), "");
  assert.equal(getModmailReplyContent({ content: "a".repeat(10) }, 5), "aaaa…");
});
