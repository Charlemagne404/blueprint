const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_ANTI_RAID_SLOWMODE_SECONDS,
  createCooldownStore,
  getLockdownSlowmodeSeconds,
} = require("../src/runtime-utils");

test("cooldown store blocks repeated executions until the window expires", () => {
  let now = 1_000;
  const store = createCooldownStore({ now: () => now });

  assert.equal(store.consume("guild:rule", 30), true);
  assert.equal(store.consume("guild:rule", 30), false);

  now += 29_999;
  assert.equal(store.consume("guild:rule", 30), false);

  now += 1;
  assert.equal(store.consume("guild:rule", 30), true);
});

test("cooldown store does not block zero-second cooldown rules", () => {
  const store = createCooldownStore();

  assert.equal(store.consume("guild:rule", 0), true);
  assert.equal(store.consume("guild:rule", 0), true);
});

test("anti-raid lockdown slowmode never lowers an existing channel slowmode", () => {
  assert.equal(getLockdownSlowmodeSeconds(0), DEFAULT_ANTI_RAID_SLOWMODE_SECONDS);
  assert.equal(getLockdownSlowmodeSeconds(3), DEFAULT_ANTI_RAID_SLOWMODE_SECONDS);
  assert.equal(getLockdownSlowmodeSeconds(15), 15);
});
