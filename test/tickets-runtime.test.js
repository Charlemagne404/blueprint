const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildTicketTranscriptPayloads,
  buildTranscript,
  buildTicketPanelPayload,
  CLOSE_TICKET_CUSTOM_ID,
  OPEN_TICKET_CUSTOM_ID,
  sanitizeTicketName,
} = require("../src/modules/tickets-runtime");

test("ticket runtime uses stable component ids", () => {
  assert.equal(OPEN_TICKET_CUSTOM_ID, "tickets:open");
  assert.equal(CLOSE_TICKET_CUSTOM_ID, "tickets:close");
});

test("ticket names are normalized for channel creation", () => {
  assert.equal(sanitizeTicketName("Charlie Arnerstål"), "charlie-arnerst-l");
  assert.equal(sanitizeTicketName("  $$$  "), "member");
});

test("ticket panel payload includes the configured title and button", () => {
  const payload = buildTicketPanelPayload({
    ticketsPanelTitle: "Need help? Open a support ticket.",
  });

  assert.match(payload.content, /Need help\? Open a support ticket\./);
  assert.equal(payload.components.length, 1);
});

test("ticket transcripts paginate and preserve older messages", async () => {
  const firstPage = new Map(
    Array.from({ length: 100 }, (_, index) => [
      `first-${index}`,
      {
        author: { tag: "Recent user" },
        content: `Recent message ${index}`,
        createdTimestamp: 1_000 + index,
        id: `first-${index}`,
      },
    ]),
  );
  const secondPage = new Map([
    ["old-1", {
      author: { tag: "Older user" },
      content: "Older message",
      createdTimestamp: 1,
      id: "old-1",
    }],
  ]);
  const fetchOptions = [];
  const channel = {
    messages: {
      fetch: async (options) => {
        fetchOptions.push(options);
        return options.before ? secondPage : firstPage;
      },
    },
  };

  const transcript = await buildTranscript(channel);
  assert.equal(fetchOptions.length, 2);
  assert.equal(fetchOptions[1].before, "first-0");
  assert.match(transcript, /Older user: Older message/);
  assert.ok(transcript.indexOf("Older message") < transcript.indexOf("Recent message 0"));
});

test("ticket transcript payloads stay below Discord message limits", () => {
  const payloads = buildTicketTranscriptPayloads({
    channelName: "support-ticket",
    openerId: "123456789012345678",
    transcript: "line ".repeat(1600),
  });

  assert.ok(payloads.length > 1);
  assert.ok(payloads.every((payload) => payload.content.length <= 2000));
  assert.deepEqual(payloads[0].allowedMentions, {
    parse: [],
    users: ["123456789012345678"],
  });
  assert.deepEqual(payloads[1].allowedMentions, { parse: [], users: [] });
});
