const { escapeHtml, renderModuleCard, renderModuleFacts } = require("../html");
const {
  canSendMessages,
  getChannelLabel,
  getRoleLabel,
  normalizeId,
  normalizeText,
  splitTextIntoChunks,
} = require("./common");

const defaults = {
  applicationsEnabled: false,
  applicationsChannelId: "",
  applicationsReviewerRoleId: "",
  applicationsFormTitle: "Staff Application",
  applicationsQuestions: "Why do you want to help this server?\nWhat timezone are you in?",
};

function normalizeApplicationSettings(input = {}) {
  return {
    applicationsEnabled: input.applicationsEnabled === true || input.applicationsEnabled === "on",
    applicationsChannelId: normalizeId(input.applicationsChannelId),
    applicationsReviewerRoleId: normalizeId(input.applicationsReviewerRoleId),
    applicationsFormTitle: normalizeText(input.applicationsFormTitle, "Staff Application", 80),
    applicationsQuestions: normalizeText(
      input.applicationsQuestions,
      "Why do you want to help this server?\nWhat timezone are you in?",
      800,
    ),
  };
}

function validateApplicationSettings(settings, guild, botMember) {
  if (!settings.applicationsEnabled) return [];

  const prompts = getApplicationPrompts(settings);

  if (prompts.length === 0) {
    return ["Add at least one application prompt before enabling this module."];
  }

  if (prompts.length > 5) {
    return ["Applications support up to 5 prompts so they fit the Discord modal flow."];
  }

  if (!settings.applicationsChannelId) {
    return ["Choose an applications destination channel before enabling this module."];
  }

  const destination = guild.channels.cache.get(settings.applicationsChannelId);
  if (!destination) {
    return ["Choose a valid applications destination channel in this server."];
  }

  if (botMember && !canSendMessages(destination, botMember)) {
    return ["Choose an applications channel where Blueprint can post submissions."];
  }

  if (!settings.applicationsReviewerRoleId) {
    return ["Select a reviewer role before enabling applications."];
  }

  if (!guild.roles.cache.has(settings.applicationsReviewerRoleId)) {
    return ["Select a valid reviewer role for applications."];
  }

  return [];
}

function getApplicationState(settings, channelOptions = [], roleOptions = []) {
  if (!settings.applicationsEnabled) return "disabled";
  if (!settings.applicationsChannelId || !settings.applicationsReviewerRoleId) return "incomplete";

  if (
    channelOptions.length > 0 &&
    !channelOptions.some((channel) => channel.id === settings.applicationsChannelId)
  ) {
    return "incomplete";
  }

  if (
    roleOptions.length > 0 &&
    !roleOptions.some((role) => role.id === settings.applicationsReviewerRoleId)
  ) {
    return "incomplete";
  }

  return "live";
}

function renderApplicationsModuleCard({ blockerText = "", channelOptions, defaultOpen = false, roleOptions, settings }) {
  const state = getApplicationState(settings, channelOptions, roleOptions);
  const statusHtml = `<div class="status-pill status-pill-${state}" data-status-target="applications">${escapeHtml(getStatusLabel(state))}</div>`;
  const channelOptionsHtml = [
    `<option value="">Select a channel</option>`,
    ...channelOptions.map((channel) => `<option value="${escapeHtml(channel.id)}" ${settings.applicationsChannelId === channel.id ? "selected" : ""}>${escapeHtml(channel.label)}</option>`),
  ].join("");
  const roleOptionsHtml = [
    `<option value="">Select a role</option>`,
    ...roleOptions.map((role) => `<option value="${escapeHtml(role.id)}" ${settings.applicationsReviewerRoleId === role.id ? "selected" : ""}>${escapeHtml(role.label)}</option>`),
  ].join("");

  const summaryHtml = renderModuleFacts([
    { label: "Destination", valueHtml: escapeHtml(getChannelLabel(settings.applicationsChannelId, channelOptions)) },
    { label: "Reviewers", valueHtml: escapeHtml(getRoleLabel(settings.applicationsReviewerRoleId, roleOptions)) },
  ]);

  return renderModuleCard({
    bodyHtml: `
      <div class="module-layout">
        <div class="module-fields">
          <div class="field-grid">
            <label>
              <span>Form title</span>
              <input type="text" maxlength="80" name="applicationsFormTitle" value="${escapeHtml(settings.applicationsFormTitle)}" />
            </label>
            <label>
              <span>Destination channel</span>
              <select name="applicationsChannelId">${channelOptionsHtml}</select>
            </label>
            <label>
              <span>Reviewer role</span>
              <select name="applicationsReviewerRoleId">${roleOptionsHtml}</select>
            </label>
            <label class="module-field-wide">
              <span>Questions (one per line, up to 5)</span>
              <textarea name="applicationsQuestions" rows="6" maxlength="800">${escapeHtml(settings.applicationsQuestions)}</textarea>
            </label>
          </div>
        </div>
        <aside class="preview-card">
          <span class="preview-label">Module summary</span>
          <div class="countdown-preview">${escapeHtml(getPreview(settings, channelOptions, roleOptions, state))}</div>
        </aside>
      </div>
    `,
    checked: settings.applicationsEnabled,
    blockerHtml: escapeHtml(blockerText),
    defaultOpen,
    descriptionHtml: "Collect structured applications with customizable prompts and reviewer routing.",
    eyebrow: "Applications",
    inputName: "applicationsEnabled",
    moduleKey: "applications",
    moduleId: "applications",
    statusHtml,
    summaryHtml,
    theme: "suggestions",
    titleHtml: "Forms and applications",
  });
}

module.exports = {
  buildApplicationSubmissionMessages,
  defaults,
  getApplicationState,
  getApplicationPrompts,
  normalizeApplicationSettings,
  renderApplicationsModuleCard,
  validateApplicationSettings,
};

function getStatusLabel(state) {
  if (state === "live") return "Live";
  if (state === "incomplete") return "Needs setup";
  return "Disabled";
}

function getPreview(settings, channelOptions, roleOptions, state) {
  if (state !== "live") {
    return "Applications need a destination channel and reviewer role before activation.";
  }

  const questionCount = getApplicationPrompts(settings).length;
  return `${settings.applicationsFormTitle} routes to ${getChannelLabel(settings.applicationsChannelId, channelOptions)} with ${questionCount} prompt(s), reviewed by ${getRoleLabel(settings.applicationsReviewerRoleId, roleOptions)}.`;
}

function getApplicationPrompts(settings = {}) {
  return String(settings.applicationsQuestions || "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildApplicationSubmissionMessages({
  answers = [],
  reviewerRoleId = "",
  title = "Application",
  userId = "",
  userTag = "",
} = {}) {
  const submitter = userId ? `<@${userId}>` : userTag || "Unknown member";
  const answerLines = answers.flatMap(({ prompt, answer }) => [
    `**${String(prompt || "Question").trim()}**`,
    String(answer || "(no answer)").trim() || "(no answer)",
    "",
  ]);
  const chunks = splitTextIntoChunks(answerLines.join("\n"), 1700);
  const safeChunks = chunks.length > 0 ? chunks : ["(No answers provided)"];

  return safeChunks.map((chunk, index) => ({
    allowedMentions: {
      parse: [],
      roles: index === 0 && reviewerRoleId ? [reviewerRoleId] : [],
      users: index === 0 && userId ? [userId] : [],
    },
    content: [
      index === 0
        ? `**${String(title || "Application").trim()}**`
        : `**${String(title || "Application").trim()} (continued, part ${index + 1})**`,
      index === 0 ? `Submitted by: ${submitter}` : "",
      index === 0 && reviewerRoleId ? `Reviewer role: <@&${reviewerRoleId}>` : "",
      "",
      chunk,
    ]
      .filter(Boolean)
      .join("\n"),
  }));
}
