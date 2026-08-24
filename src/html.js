function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderFeatureToggle({
  checked,
  descriptionHtml,
  disabledLabel = "Disabled",
  enabledLabel = "Enabled",
  inputName,
  kindLabel,
  titleHtml,
}) {
  return `
    <label class="feature-toggle-card">
      <input
        type="checkbox"
        name="${escapeHtml(inputName)}"
        value="on"
        ${checked ? "checked" : ""}
      />
      <span class="feature-toggle-surface">
        <span class="feature-toggle-copy">
          <span class="feature-toggle-kicker">${escapeHtml(kindLabel)}</span>
          <span class="feature-toggle-title">${titleHtml}</span>
          <span class="feature-toggle-description">${descriptionHtml}</span>
        </span>
        <span class="feature-toggle-action" aria-hidden="true">
          <span class="feature-toggle-state feature-toggle-state-enabled">
            ${escapeHtml(enabledLabel)}
          </span>
          <span class="feature-toggle-state feature-toggle-state-disabled">
            ${escapeHtml(disabledLabel)}
          </span>
          <span class="feature-toggle-switch">
            <span class="feature-toggle-switch-knob"></span>
          </span>
        </span>
      </span>
    </label>
  `;
}

function renderModuleCard({
  blockerHtml = "",
  bodyHtml,
  checked,
  defaultOpen = false,
  descriptionHtml,
  disabledLabel = "Module off",
  enabledLabel = "Module on",
  eyebrow,
  inputName,
  moduleKey = moduleId,
  moduleId,
  statusHtml = "",
  summaryHtml = "",
  theme = "default",
  titleHtml,
}) {
  const safeModuleId = escapeHtml(moduleId);
  const panelId = `module-panel-${safeModuleId}`;
  const sectionId = `module-${safeModuleId}`;
  const moduleSymbol = getModuleSymbol(moduleId);

  return `
    <section
      id="${sectionId}"
      class="settings-card module-card module-card-${escapeHtml(theme)} ${defaultOpen ? "is-open" : ""}"
      data-module-card
      data-module-id="${safeModuleId}"
      data-module-default-open="${defaultOpen ? "true" : "false"}"
      data-module-key="${escapeHtml(moduleKey)}"
      data-settings-scope="${escapeHtml(moduleKey)}"
      tabindex="-1"
    >
      <div class="module-card-header">
        <button
          class="module-card-trigger"
          type="button"
          aria-expanded="${defaultOpen ? "true" : "false"}"
          aria-controls="${panelId}"
          data-module-trigger
        >
          <span class="module-card-copy">
            <span class="eyebrow">${escapeHtml(eyebrow)}</span>
            <span class="module-card-title-row">
              <span class="module-card-symbol" aria-hidden="true">${moduleSymbol}</span>
              <span class="module-card-title">${titleHtml}</span>
              <span class="module-card-chevron" aria-hidden="true"></span>
            </span>
            <span class="module-card-description">${descriptionHtml}</span>
            <span
              class="module-card-blocker ${blockerHtml ? "" : "is-hidden"}"
              data-module-blocker="${escapeHtml(moduleKey)}"
            >
              ${blockerHtml}
            </span>
            ${summaryHtml}
          </span>
        </button>

        <div class="module-card-actions">
          ${statusHtml}
          ${renderModuleToggle({
            checked,
            disabledLabel,
            enabledLabel,
            inputName,
          })}
        </div>
      </div>

      <div
        class="module-card-panel"
        id="${panelId}"
        aria-hidden="${defaultOpen ? "false" : "true"}"
        ${defaultOpen ? "" : "inert"}
        data-module-panel
      >
        <div class="module-card-panel-inner">
          ${bodyHtml}
        </div>
      </div>
    </section>
  `;
}

function getModuleSymbol(moduleId) {
  const symbols = {
    "ai-tools": "✦",
    announcements: "〰",
    "anti-raid": "⌁",
    applications: "◫",
    "audit-log": "◌",
    "auto-moderation": "⊘",
    "auto-role": "◇",
    automations: "↗",
    countdown: "◷",
    "join-screening": "◉",
    leveling: "↑",
    modmail: "✉",
    "reaction-roles": "◇",
    starboard: "★",
    suggestions: "↗",
    tickets: "□",
    welcome: "✦",
  };

  return symbols[moduleId] || "◌";
}

function renderModuleFacts(facts = []) {
  const items = facts
    .filter((fact) => fact && fact.label && fact.valueHtml)
    .map((fact) => `
      <span class="module-fact">
        <span class="module-fact-label">${escapeHtml(fact.label)}</span>
        <strong class="module-fact-value">${fact.valueHtml}</strong>
      </span>
    `)
    .join("");

  if (!items) {
    return "";
  }

  return `<span class="module-facts">${items}</span>`;
}

function renderModuleToggle({
  checked,
  disabledLabel = "Off",
  enabledLabel = "On",
  inputName,
}) {
  return `
    <label class="module-toggle" data-module-toggle>
      <input
        type="checkbox"
        name="${escapeHtml(inputName)}"
        value="on"
        ${checked ? "checked" : ""}
      />
      <span class="module-toggle-copy">
        <span class="module-toggle-eyebrow">Enable module</span>
        <span class="module-toggle-state module-toggle-state-enabled">${escapeHtml(enabledLabel)}</span>
        <span class="module-toggle-state module-toggle-state-disabled">${escapeHtml(disabledLabel)}</span>
      </span>
      <span class="module-toggle-switch" aria-hidden="true">
        <span class="module-toggle-switch-track"></span>
        <span class="module-toggle-switch-knob"></span>
      </span>
    </label>
  `;
}

module.exports = {
  escapeHtml,
  renderFeatureToggle,
  renderModuleCard,
  renderModuleFacts,
};
