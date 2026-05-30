const { escapeHtml, renderModuleCard, renderModuleFacts } = require("../html");
const {
  canSendMessages,
  getChannelLabel,
  normalizeId,
  normalizeText,
} = require("./common");

const defaults = {
  aiToolsEnabled: false,
  aiToolsChannelId: "",
  aiToolsPersona: "Helpful and concise community copilot",
  aiToolsRequireMention: true,
};

function normalizeAiToolsSettings(input = {}) {
  return {
    aiToolsEnabled: input.aiToolsEnabled === true || input.aiToolsEnabled === "on",
    aiToolsChannelId: normalizeId(input.aiToolsChannelId),
    aiToolsPersona: normalizeText(input.aiToolsPersona, defaults.aiToolsPersona, 120),
    aiToolsRequireMention: input.aiToolsRequireMention === true || input.aiToolsRequireMention === "on",
  };
}

function validateAiToolsSettings(settings, guild, botMember) {
  if (!settings.aiToolsEnabled) {
    return [];
  }

  if (!settings.aiToolsChannelId) {
    return ["Select an AI tools channel before enabling this module."];
  }

  const channel = guild.channels.cache.get(settings.aiToolsChannelId);
  if (!canSendMessages(channel, botMember)) {
    return ["Choose an AI tools channel where Blueprint can respond safely."];
  }

  return [];
}

function getAiToolsState(settings, channelOptions = []) {
  if (!settings.aiToolsEnabled) {
    return "disabled";
  }

  if (!settings.aiToolsChannelId) {
    return "incomplete";
  }

  if (
    channelOptions.length > 0 &&
    !channelOptions.some((channel) => channel.id === settings.aiToolsChannelId)
  ) {
    return "incomplete";
  }

  return "live";
}

function getAiToolsStatusLabel(state) {
  if (state === "live") {
    return "Live";
  }

  if (state === "incomplete") {
    return "Needs setup";
  }

  return "Disabled";
}

function renderAiToolsModuleCard({
  blockerText = "",
  channelOptions,
  defaultOpen = false,
  settings,
}) {
  const state = getAiToolsState(settings, channelOptions);
  const channelSelectOptions = [
    `<option value="">Select a channel</option>`,
    ...channelOptions.map((channel) => `
      <option value="${escapeHtml(channel.id)}" ${
        settings.aiToolsChannelId === channel.id ? "selected" : ""
      }>
        ${escapeHtml(channel.label)}
      </option>
    `),
  ].join("");

  const statusHtml = `
    <div class="status-pill status-pill-${state}" data-status-target="aiTools">${escapeHtml(getAiToolsStatusLabel(state))}</div>
  `;
  const summaryHtml = renderModuleFacts([
    {
      label: "AI channel",
      valueHtml: escapeHtml(getChannelLabel(settings.aiToolsChannelId, channelOptions)),
    },
    {
      label: "Trigger",
      valueHtml: escapeHtml(settings.aiToolsRequireMention ? "Mention required" : "Channel free-chat"),
    },
  ]);

  return renderModuleCard({
    bodyHtml: `
      <div class="module-layout">
        <div class="module-fields">
          <div class="field-grid">
            <label>
              <span>AI tools channel</span>
              <select name="aiToolsChannelId">
                ${channelSelectOptions}
              </select>
            </label>
          </div>

          <label>
            <span>Assistant persona</span>
            <input
              name="aiToolsPersona"
              maxlength="120"
              value="${escapeHtml(settings.aiToolsPersona)}"
            />
          </label>

          <div class="subsection">
            <label class="checkbox-chip checkbox-chip-block">
              <input
                type="checkbox"
                name="aiToolsRequireMention"
                value="on"
                ${settings.aiToolsRequireMention ? "checked" : ""}
              />
              <span>Require a bot mention before replying</span>
            </label>
          </div>
        </div>

        <aside class="preview-card">
          <span class="preview-label">Module summary</span>
          <div class="countdown-preview">${escapeHtml(getAiToolsPreview(settings, channelOptions, state))}</div>
          <div class="preview-meta preview-meta-dual">
            <div>
              <span>Status</span>
              <strong>${escapeHtml(getAiToolsStatusLabel(state))}</strong>
            </div>
            <div>
              <span>Mode</span>
              <strong>${escapeHtml(settings.aiToolsRequireMention ? "Mention-only" : "Open channel")}</strong>
            </div>
          </div>
          <p class="preview-note">Keep AI help contained to one space. Members also need a linked Continental ID account before Blueprint will answer.</p>
        </aside>
      </div>
    `,
    checked: settings.aiToolsEnabled,
    blockerHtml: escapeHtml(blockerText),
    defaultOpen,
    descriptionHtml:
      "Create a dedicated AI helper channel with Vanguard-style session memory, controllable response behavior, and linked-account access checks.",
    eyebrow: "AI tools",
    inputName: "aiToolsEnabled",
    moduleKey: "aiTools",
    moduleId: "ai-tools",
    statusHtml,
    summaryHtml,
    theme: "welcome",
    titleHtml: "AI helper workspace",
  });
}

module.exports = {
  defaults,
  getAiToolsState,
  normalizeAiToolsSettings,
  renderAiToolsModuleCard,
  validateAiToolsSettings,
};

function getAiToolsPreview(settings, channelOptions, state) {
  if (state !== "live") {
    return "AI tools stay off until a dedicated channel is selected.";
  }

  return `AI replies are limited to ${getChannelLabel(settings.aiToolsChannelId, channelOptions)} using the "${settings.aiToolsPersona}" persona.`;
}
