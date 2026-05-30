const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getLevelFromXp,
  getXpRequiredForLevel,
  renderLevelUpMessage,
  shouldGrantLevelingXp,
} = require("../src/modules/leveling-runtime");

test("leveling progression uses quadratic thresholds", () => {
  assert.equal(getXpRequiredForLevel(1), 100);
  assert.equal(getXpRequiredForLevel(3), 900);
  assert.equal(getLevelFromXp(0), 0);
  assert.equal(getLevelFromXp(99), 0);
  assert.equal(getLevelFromXp(100), 1);
  assert.equal(getLevelFromXp(399), 1);
  assert.equal(getLevelFromXp(400), 2);
});

test("leveling cooldown blocks repeated XP until the configured window passes", () => {
  const now = new Date("2026-05-30T12:00:00.000Z");
  assert.equal(shouldGrantLevelingXp("", 60, now), true);
  assert.equal(shouldGrantLevelingXp("2026-05-30T11:59:15.000Z", 60, now), false);
  assert.equal(shouldGrantLevelingXp("2026-05-30T11:59:00.000Z", 60, now), true);
});

test("level-up messages interpolate supported tokens", () => {
  const output = renderLevelUpMessage(
    "GG {mention}, {user} reached level {level}!",
    {
      user: {
        id: "123",
        username: "Charlie",
      },
    },
    4,
  );

  assert.equal(output, "GG <@123>, Charlie reached level 4!");
});
