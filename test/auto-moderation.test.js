const test = require("node:test");
const assert = require("node:assert/strict");

const { moderateMessage } = require("../src/modules/auto-moderation");

test("automod reports when a message was moderated so later pipelines can stop", async () => {
  let deleted = false;

  const result = await moderateMessage(
    {
      author: { bot: false, id: "user-1", tag: "Member#0001" },
      channelId: "channel-1",
      content: "join us at discord.gg/blueprint",
      deletable: true,
      delete: async () => {
        deleted = true;
      },
      guild: {
        channels: { cache: new Map() },
        members: {
          fetchMe: async () => null,
          me: null,
        },
      },
      member: {
        moderatable: false,
        permissions: { has: () => false },
      },
      mentions: {
        roles: { size: 0 },
        users: { size: 0 },
      },
    },
    {
      autoModerationEnabled: true,
      autoModerationBlockedWords: [],
      autoModerationBlockInvites: true,
      autoModerationLogChannelId: "",
      autoModerationMentionLimit: 0,
      autoModerationTimeoutMinutes: 0,
    },
  );

  assert.equal(deleted, true);
  assert.deepEqual(result, {
    moderated: true,
    reasons: ["invite link"],
    timedOut: false,
  });
});

test("automod leaves clean messages alone", async () => {
  const result = await moderateMessage(
    {
      author: { bot: false },
      content: "hello team",
      guild: { channels: { cache: new Map() }, members: { fetchMe: async () => null, me: null } },
      member: { permissions: { has: () => false } },
      mentions: {
        roles: { size: 0 },
        users: { size: 0 },
      },
    },
    {
      autoModerationEnabled: true,
      autoModerationBlockedWords: [],
      autoModerationBlockInvites: true,
      autoModerationLogChannelId: "",
      autoModerationMentionLimit: 0,
      autoModerationTimeoutMinutes: 0,
    },
  );

  assert.deepEqual(result, {
    moderated: false,
    reasons: [],
  });
});
