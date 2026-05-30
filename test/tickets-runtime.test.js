const test = require("node:test");
const assert = require("node:assert/strict");

const {
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
