(function () {
  const config = window.BLUEPRINT_AUTH || {};
  const continentalId = window.ContinentalIdClient || {};
  const createContinentalPopupSessionHelper =
    typeof continentalId.createContinentalPopupSessionHelper === "function"
      ? continentalId.createContinentalPopupSessionHelper
      : null;
  const popupContract = config.popupContract || {};
  const popupName = safeText(popupContract.popupName) || "continental-id-login";
  const currentPath = `${window.location.pathname}${window.location.search}`;
  const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5];
  let activeAuthReturnTo = currentPath === "/" ? "/dashboard" : currentPath;
  const dateLabelFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
    year: "numeric",
  });
  const zonedFormatterCache = new Map();

  function safeText(value) {
    return String(value || "").trim();
  }

  function ensureAuthFeedbackNode() {
    let notice = document.querySelector("[data-auth-feedback]");
    if (notice) {
      return notice;
    }

    const main = document.querySelector("main") || document.body;
    notice = document.createElement("div");
    notice.className = "notice notice-error";
    notice.hidden = true;
    notice.tabIndex = -1;
    notice.setAttribute("data-auth-feedback", "true");
    notice.setAttribute("role", "alert");
    main.prepend(notice);
    return notice;
  }

  function showAuthFeedback(message, tone) {
    const notice = ensureAuthFeedbackNode();
    notice.className = `notice notice-${tone || "error"}`;
    notice.textContent = message;
    notice.hidden = false;
    if (typeof notice.focus === "function") {
      notice.focus({ preventScroll: false });
    }
  }

  function clearAuthFeedback() {
    const notice = document.querySelector("[data-auth-feedback]");
    if (!notice) {
      return;
    }

    notice.hidden = true;
    notice.textContent = "";
  }


  function buildAuthError(error, fallbackMessage) {
    const code = safeText(error && error.code);
    const correlationId = safeText(error && error.correlationId);
    const message = safeText(error && error.message) || fallbackMessage;
    const nextError = new Error(message);
    nextError.code = code || "";
    nextError.correlationId = correlationId || "";
    return nextError;
  }

  function getModuleStateStorageKey() {
    return `blueprint:module-card-state:${window.location.pathname}`;
  }

  function getGuildSearchStorageKey() {
    return `blueprint:guild-search:${window.location.pathname}`;
  }

  function toKebabCase(value) {
    return String(value || "")
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .toLowerCase();
  }

  function getModuleSectionId(moduleKey) {
    return `module-${toKebabCase(moduleKey)}`;
  }

  function loadModuleCardStates() {
    try {
      return JSON.parse(window.localStorage.getItem(getModuleStateStorageKey()) || "{}");
    } catch {
      return {};
    }
  }

  function persistModuleCardStates(states) {
    try {
      window.localStorage.setItem(getModuleStateStorageKey(), JSON.stringify(states));
    } catch {
      // Ignore storage failures so the collapse UI still works without persistence.
    }
  }

  function syncModuleCard(card, open) {
    const button = card.querySelector("[data-module-trigger]");
    const panel = card.querySelector("[data-module-panel]");
    if (!button || !panel) {
      return;
    }

    card.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", open ? "true" : "false");
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    panel.inert = !open;
  }

  function setModuleCardOpen(card, open, persist = true) {
    if (!card) {
      return;
    }

    syncModuleCard(card, open);
    if (!persist) {
      return;
    }

    const moduleId = safeText(card.getAttribute("data-module-id"));
    if (!moduleId) {
      return;
    }

    const states = loadModuleCardStates();
    states[moduleId] = open;
    persistModuleCardStates(states);
  }

  function openModuleCardById(sectionId, options = {}) {
    const target = document.getElementById(sectionId);
    if (!target) {
      return;
    }

    const card = target.closest("[data-module-card]") || target;
    setModuleCardOpen(card, true);

    if (options.updateHash !== false) {
      const nextHash = `#${sectionId}`;
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, "", nextHash);
      }
    }

    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      if (options.focus !== false) {
        const focusTarget = card.querySelector("[data-module-trigger]") || target;
        if (focusTarget && typeof focusTarget.focus === "function") {
          focusTarget.focus({ preventScroll: true });
        }
      }
    });
  }

  function buildAuthCompleteUrl(returnTo) {
    const url = new URL(config.authCompleteUrl || `${window.location.origin}/auth/complete`);
    url.searchParams.set("returnTo", returnTo || "/dashboard");
    return url.toString();
  }

  function getCsrfHeaders() {
    return config.csrfToken ? { "X-CSRF-Token": config.csrfToken } : {};
  }

  async function syncLocalSession(accessToken) {
    const response = await fetch("/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getCsrfHeaders(),
      },
      body: JSON.stringify({ accessToken }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw buildAuthError(payload.error, payload.message || "Could not sync your session.");
    }

    const payload = await response.json();
    if (payload.csrfToken) {
      config.csrfToken = payload.csrfToken;
    }
    return payload;
  }

  async function refreshDashboardAuth() {
    const response = await fetch(`${config.authApiBaseUrl}/api/auth/refresh_token`, {
      method: "POST",
      credentials: "include",
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw buildAuthError(
        payload.error,
        payload.message || "Could not refresh your Dashboard session.",
      );
    }

    const accessToken = safeText(payload.accessToken || payload.token);
    if (!accessToken) {
      throw buildAuthError(
        { code: "auth/session-missing" },
        payload.message || "No active Dashboard session was found.",
      );
    }

    return accessToken;
  }

  async function syncFromDashboard(returnTo, options) {
    const redirect = !options || options.redirect !== false;
    const accessToken = await refreshDashboardAuth();
    await syncLocalSession(accessToken);
    if (redirect) {
      window.location.href = returnTo || "/dashboard";
    }
  }

  const popupAuthHelper =
    createContinentalPopupSessionHelper &&
    createContinentalPopupSessionHelper({
      apiBaseUrl: config.authApiBaseUrl,
      buildRedirectUrl: (returnTo) => buildAuthCompleteUrl(returnTo),
      loginPopupUrl: config.authLoginPopupUrl,
      onAccessToken: async (accessToken) => {
        await syncLocalSession(accessToken);
        window.location.href = activeAuthReturnTo || "/dashboard";
      },
      onError: (error) => {
        const code = error.code || "auth/session-sync-failed";
        if (code === "auth/message-origin-rejected") {
          console.warn("[auth]", { code, correlationId: error.correlationId || "" });
          return;
        }

      showAuthFeedback(error.message || "Authentication could not be completed.", "error");
      const authCompleteMarker = document.querySelector("[data-auth-complete='true']");
      if (authCompleteMarker) {
        authCompleteMarker.textContent =
          error.message || "No active Continental ID session was found. Use sign-in to continue.";
      }
      console.error("[auth]", {
        code,
        correlationId: error.correlationId || "",
        });
      },
      onOauthLinked: async () => {
        await syncFromDashboard(activeAuthReturnTo || currentPath);
      },
      popupName,
      trustedLoginOrigins: config.trustedLoginOrigins || [],
    });

  function openLogin(returnTo) {
    clearAuthFeedback();
    activeAuthReturnTo = returnTo || "/dashboard";
    if (!popupAuthHelper) {
      showAuthFeedback("Continental ID client failed to load.", "error");
      return;
    }
    popupAuthHelper.open({ returnTo: activeAuthReturnTo });
  }

  async function startDiscordLink(returnTo, button) {
    if (button) {
      button.disabled = true;
    }

    try {
      const response = await fetch("/auth/link/discord/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfHeaders(),
        },
        body: JSON.stringify({ returnTo }),
      });

      if (response.status === 401) {
        await syncFromDashboard(returnTo, { redirect: false });
        await startDiscordLink(returnTo, button);
        return;
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.url) {
        throw new Error(payload.message || "Could not start Discord linking.");
      }

      const popup = window.open(
        payload.url,
        "ContinentalIdDiscordLink",
        "popup=yes,width=520,height=760,resizable=yes,scrollbars=yes",
      );

      if (!popup) {
        window.location.href = payload.url;
        return;
      }

      popup.focus();
    } catch (error) {
      showAuthFeedback(error.message || "Could not start Discord linking.", "error");
    } finally {
      if (button) {
        button.disabled = false;
      }
    }
  }

  function bindLoginButtons() {
    document.querySelectorAll("#login-button, #relogin-button").forEach((button) => {
      button.addEventListener("click", () => openLogin(currentPath));
    });
  }

  function bindLinkDiscordButton() {
    const button = document.getElementById("connect-discord-button");
    if (!button) {
      return;
    }

    button.addEventListener("click", () => {
      startDiscordLink(currentPath, button);
    });
  }

  function bindCountdownControls() {
    const modeSelect = document.querySelector("[data-countdown-mode]");
    const scheduleFields = document.querySelector("[data-countdown-schedule-fields]");
    const schedulePanel = document.querySelector("[data-countdown-schedule-panel]");
    const modeCopy = document.querySelector("[data-countdown-mode-copy]");
    const alertToggle = document.querySelector("input[name='countdownAlertEnabled']");
    const alertFields = document.querySelector("[data-countdown-alert-fields]");
    const alertPanel = document.querySelector("[data-countdown-alert-panel]");

    if (!modeSelect || !scheduleFields || !modeCopy) {
      return;
    }

    const modeDescriptions = {
      "active-days":
        "Count only selected weekdays after today and before the target date. Excluded dates only reduce the countdown when they fall on one of those counted days.",
      calendar: "Count every calendar day from today to the target date.",
    };

    function syncCountdownMode() {
      const mode = safeText(modeSelect.value) || "calendar";
      scheduleFields.classList.toggle("is-hidden", mode !== "active-days");
      modeCopy.textContent = modeDescriptions[mode] || modeDescriptions.calendar;
      if (mode === "active-days" && schedulePanel) {
        schedulePanel.open = true;
      }
    }

    modeSelect.addEventListener("change", syncCountdownMode);
    syncCountdownMode();

    if (alertToggle && alertFields) {
      function syncCountdownAlerts() {
        alertFields.classList.toggle("is-hidden", !alertToggle.checked);
        if (alertToggle.checked && alertPanel) {
          alertPanel.open = true;
        }
      }

      alertToggle.addEventListener("change", syncCountdownAlerts);
      syncCountdownAlerts();
    }
  }

  function bindGuildSearchControls() {
    const searchInput = document.querySelector("[data-guild-search]");
    const attentionToggle = document.querySelector("[data-guild-attention-filter]");
    const cards = Array.from(document.querySelectorAll("[data-guild-card]"));
    const emptyState = document.querySelector("[data-guild-search-empty]");

    if (!searchInput || cards.length === 0) {
      return;
    }

    try {
      const saved = JSON.parse(window.localStorage.getItem(getGuildSearchStorageKey()) || "{}");
      if (typeof saved.query === "string") {
        searchInput.value = saved.query;
      }
      if (attentionToggle && typeof saved.attentionOnly === "boolean") {
        attentionToggle.checked = saved.attentionOnly;
      }
    } catch {
      // Ignore malformed storage and fall back to the default toolbar state.
    }

    function syncVisibleCards() {
      const query = safeText(searchInput.value).toLowerCase();
      const attentionOnly = Boolean(attentionToggle && attentionToggle.checked);
      let visibleCount = 0;

      cards.forEach((card) => {
        const name = safeText(card.getAttribute("data-guild-name")).toLowerCase();
        const hasAttention = safeText(card.getAttribute("data-guild-attention")) === "true";
        const matchesQuery = !query || name.includes(query);
        const matchesAttention = !attentionOnly || hasAttention;
        const visible = matchesQuery && matchesAttention;

        card.classList.toggle("is-hidden", !visible);
        if (visible) {
          visibleCount += 1;
        }
      });

      if (emptyState) {
        emptyState.classList.toggle("is-hidden", visibleCount > 0);
      }

      try {
        window.localStorage.setItem(
          getGuildSearchStorageKey(),
          JSON.stringify({
            attentionOnly,
            query: searchInput.value,
          }),
        );
      } catch {
        // Ignore storage failures so search still works in-memory.
      }
    }

    searchInput.addEventListener("input", syncVisibleCards);
    if (attentionToggle) {
      attentionToggle.addEventListener("change", syncVisibleCards);
    }
    syncVisibleCards();
  }

  function bindModuleCards() {
    const cards = Array.from(document.querySelectorAll("[data-module-card]"));
    if (cards.length === 0) {
      return;
    }

    const savedStates = loadModuleCardStates();

    cards.forEach((card) => {
      const moduleId = safeText(card.getAttribute("data-module-id"));
      const defaultOpen = safeText(card.getAttribute("data-module-default-open")) === "true";
      const button = card.querySelector("[data-module-trigger]");
      if (!moduleId || !button) {
        return;
      }

      const initialOpen =
        typeof savedStates[moduleId] === "boolean" ? savedStates[moduleId] : defaultOpen;
      setModuleCardOpen(card, initialOpen, false);

      button.addEventListener("click", () => {
        const nextOpen = !card.classList.contains("is-open");
        setModuleCardOpen(card, nextOpen);
      });
    });

    if (window.location.hash.startsWith("#module-")) {
      openModuleCardById(window.location.hash.slice(1), { focus: false, updateHash: false });
    }
  }

  function bindModuleJumpLinks() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("[data-jump-module]");
      if (!link) {
        return;
      }

      const sectionId = safeText(link.getAttribute("data-jump-module"));
      if (!sectionId) {
        return;
      }

      event.preventDefault();
      openModuleCardById(sectionId);
    });
  }

  function moduleNavigationMatchesFilter(card, filter) {
    if (filter === "all") {
      return true;
    }

    const enabled = card.getAttribute("data-module-enabled") === "true";
    const state = safeText(card.getAttribute("data-module-state"));
    const blocker = safeText(card.getAttribute("data-module-blocker"));

    if (filter === "needs-setup") {
      return enabled && (state === "incomplete" || Boolean(blocker));
    }

    return filter === "enabled" ? enabled : !enabled;
  }

  function syncModuleLibraryFilter() {
    const filter = document.querySelector("[data-module-filter]");
    const results = document.querySelector("[data-module-library-results]");
    if (!filter) {
      return;
    }

    const selectedFilter = safeText(filter.value) || "all";
    const cards = Array.from(document.querySelectorAll("[data-module-nav]"));
    let visibleCount = 0;

    cards.forEach((card) => {
      const visible = moduleNavigationMatchesFilter(card, selectedFilter);
      card.hidden = !visible;
      if (visible) {
        visibleCount += 1;
      }
    });

    document.querySelectorAll("[data-module-group]").forEach((group) => {
      group.hidden = !group.querySelector("[data-module-nav]:not([hidden])");
    });

    if (results) {
      const filterLabels = {
        all: "all modules",
        disabled: "disabled modules",
        enabled: "enabled modules",
        "needs-setup": "modules that need setup",
      };
      results.textContent = `Showing ${visibleCount} ${filterLabels[selectedFilter] || "modules"}.`;
    }
  }

  function bindModuleLibraryFilter() {
    const filter = document.querySelector("[data-module-filter]");
    if (!filter) {
      return;
    }

    filter.addEventListener("change", syncModuleLibraryFilter);
    syncModuleLibraryFilter();
  }

  function focusFlashNotice() {
    const notice = document.querySelector("[data-flash-notice]");
    if (!notice || typeof notice.focus !== "function") {
      return;
    }

    window.requestAnimationFrame(() => {
      notice.focus({ preventScroll: false });
    });
  }

  function bindSettingsFormUX() {
    const form = document.querySelector("[data-settings-form]");
    if (!form) {
      return;
    }

    const saveBar = form.querySelector("[data-save-bar]");
    const saveButton = form.querySelector("[data-save-button]");
    const discardButton = form.querySelector("[data-discard-button]");
    const saveTitle = form.querySelector("[data-save-title]");
    const saveStatus = form.querySelector("[data-save-status]");
    const setupRail = document.querySelector("[data-setup-rail]");
    const setupIssueCount = document.querySelector("[data-setup-issue-count]");
    const nextIssueLabel = document.querySelector("[data-next-issue-label]");
    const nextIssueCopy = document.querySelector("[data-next-issue-copy]");
    const validationSummary = document.querySelector("[data-validation-summary]");
    const validationLead = document.querySelector("[data-validation-lead]");
    const validationList = document.querySelector("[data-validation-list]");
    const overviewEnabled = document.querySelector("[data-overview-enabled]");
    const overviewAttention = document.querySelector("[data-overview-attention]");
    const overviewHello = document.querySelector("[data-overview-hello]");
    const countdownAlertStatus = document.querySelector("[data-countdown-alert-status]");
    const countdownPreviewNode = form.querySelector("[data-countdown-preview]");
    const countdownModeLabel = form.querySelector("[data-countdown-mode-label]");
    const countdownStatusLabel = form.querySelector("[data-countdown-status-label]");
    const countdownTargetLabel = form.querySelector("[data-countdown-target-label]");
    const countdownMetaLine = form.querySelector("[data-countdown-meta-line]");
    const countdownScheduleLine = form.querySelector("[data-countdown-schedule-line]");
    const countdownBreakdownLine = form.querySelector("[data-countdown-breakdown-line]");
    const countdownIgnoredLine = form.querySelector("[data-countdown-ignored-line]");
    const countdownAlertPreviewNode = form.querySelector("[data-countdown-alert-preview]");
    const countdownAlertChannelLabel = form.querySelector("[data-countdown-alert-channel-label]");
    const countdownAlertTimeLabel = form.querySelector("[data-countdown-alert-time-label]");
    const countdownAlertNote = form.querySelector("[data-countdown-alert-note]");
    const countdownAlertTimeCopy = form.querySelector("[data-countdown-alert-time-copy]");
    const excludedDatesHidden = form.querySelector("[data-excluded-dates-hidden]");
    const excludedDateInput = form.querySelector("[data-excluded-date-input]");
    const excludedDateAddButton = form.querySelector("[data-excluded-date-add]");
    const excludedDateList = form.querySelector("[data-excluded-date-list]");
    const excludedDateEmpty = form.querySelector("[data-excluded-date-empty]");
    const reviewIssueButtons = Array.from(document.querySelectorAll("[data-review-issues]"));
    const expandIssueButtons = Array.from(document.querySelectorAll("[data-expand-issues]"));
    const statusLabels = {
      announcements: {
        disabled: "Disabled",
        incomplete: "Needs setup",
        live: "Live",
      },
      auditLog: {
        disabled: "Disabled",
        incomplete: "Needs setup",
        live: "Live",
      },
      autoModeration: {
        disabled: "Disabled",
        incomplete: "Needs setup",
        live: "Live",
      },
      autoRole: {
        disabled: "Disabled",
        incomplete: "Needs setup",
        live: "Live",
      },
      countdown: {
        disabled: "Disabled",
        ended: "Ended",
        incomplete: "Needs setup",
        live: "Live",
        today: "Today",
      },
      joinScreening: {
        disabled: "Disabled",
        incomplete: "Needs setup",
        live: "Live",
      },
      starboard: {
        disabled: "Disabled",
        incomplete: "Needs setup",
        live: "Live",
      },
      suggestions: {
        disabled: "Disabled",
        incomplete: "Needs setup",
        live: "Live",
      },
      welcome: {
        disabled: "Disabled",
        incomplete: "Needs setup",
        live: "Live",
      },
    };
    let initialSnapshot = serializeForm(form);
    let initialFieldState = getFieldStateSnapshot();
    let isDirty = false;

    function getStatusLabel(key, state) {
      const fallbackLabels = {
        disabled: "Disabled",
        ended: "Ended",
        incomplete: "Needs setup",
        live: "Live",
        today: "Today",
      };

      return (statusLabels[key] && statusLabels[key][state]) || fallbackLabels[state] || "Disabled";
    }

    function getField(name) {
      return form.elements.namedItem(name);
    }

    function getValue(name) {
      const field = getField(name);
      return field ? safeText(field.value) : "";
    }

    function isChecked(name) {
      const field = getField(name);
      return Boolean(field && field.checked);
    }

    function getValues(name) {
      const field = getField(name);
      if (!field) {
        return [];
      }

      if (typeof field.length === "number" && typeof field.item === "function") {
        return Array.from(field)
          .filter((item) => item && item.checked)
          .map((item) => safeText(item.value))
          .filter(Boolean);
      }

      const value = safeText(field.value);
      return value ? [value] : [];
    }

    function getFieldEntries(name) {
      const field = getField(name);
      if (!field) {
        return [];
      }

      if (typeof field.length === "number" && typeof field.item === "function") {
        return Array.from(field)
          .filter((item) => {
            if (!item) {
              return false;
            }

            if (item.type === "checkbox" || item.type === "radio") {
              return item.checked;
            }

            return true;
          })
          .map((item) => String(item.value ?? ""))
          .sort();
      }

      if (field.type === "checkbox" || field.type === "radio") {
        return field.checked ? [String(field.value ?? "on")] : [];
      }

      return [String(field.value ?? "")];
    }

    function getFieldStateSnapshot() {
      const names = Array.from(form.elements)
        .map((field) => safeText(field && field.name))
        .filter(Boolean);
      const uniqueNames = Array.from(new Set(names)).sort();

      return Object.fromEntries(
        uniqueNames.map((name) => [name, getFieldEntries(name).join("\u0000")]),
      );
    }

    function getChangedFieldNames(currentFieldState) {
      const keys = Array.from(
        new Set([
          ...Object.keys(initialFieldState),
          ...Object.keys(currentFieldState),
        ]),
      ).sort();

      return keys.filter((key) => (initialFieldState[key] || "") !== (currentFieldState[key] || ""));
    }

    function countChangedScopes(changedFieldNames) {
      const scopes = new Set();

      changedFieldNames.forEach((name) => {
        form.querySelectorAll(`[name="${name}"]`).forEach((field) => {
          const scope = safeText(
            field.closest("[data-settings-scope]")?.getAttribute("data-settings-scope"),
          );
          if (scope) {
            scopes.add(scope);
          }
        });
      });

      return scopes.size;
    }

    function getSelectedOptionLabel(name, fallback) {
      const field = getField(name);
      if (!field || !field.selectedOptions || !field.selectedOptions[0]) {
        return fallback;
      }

      return safeText(field.selectedOptions[0].textContent) || fallback;
    }

    function getModuleLabel(key) {
      const navCard = document.querySelector(`[data-module-nav="${key}"]`);
      return safeText(navCard && navCard.getAttribute("data-module-nav-label")) || key;
    }

    function getStaticModuleState() {
      return Object.fromEntries(
        Array.from(document.querySelectorAll("[data-module-nav]"))
          .map((navCard) => {
            const key = safeText(navCard.getAttribute("data-module-nav"));
            if (!key) {
              return null;
            }

            return [
              key,
              {
                blocker: safeText(navCard.getAttribute("data-module-blocker")),
                enabled: safeText(navCard.getAttribute("data-module-enabled")) === "true",
                state: safeText(navCard.getAttribute("data-module-state")) || "disabled",
              },
            ];
          })
          .filter(Boolean),
      );
    }

    function getModuleNavigationMeta(module) {
      if (!module.enabled) {
        return "Currently off";
      }

      if (module.blocker) {
        return "Finish setup";
      }

      if (module.state === "today") {
        return "Active today";
      }

      if (module.state === "ended") {
        return "Past target";
      }

      return "Ready to edit";
    }

    function getExcludedDates() {
      return normalizeExcludedDatesValue(excludedDatesHidden ? excludedDatesHidden.value : "");
    }

    function renderExcludedDates() {
      if (!excludedDateList || !excludedDateEmpty || !excludedDatesHidden) {
        return;
      }

      const dates = getExcludedDates();
      excludedDateList.innerHTML = renderExcludedDateChips(dates);
      excludedDateList.classList.toggle("is-hidden", dates.length === 0);
      excludedDateEmpty.classList.toggle("is-hidden", dates.length > 0);
    }

    function setExcludedDates(dates, dispatchEvents = true) {
      if (!excludedDatesHidden) {
        return;
      }

      excludedDatesHidden.value = dates.join(",");
      renderExcludedDates();

      if (!dispatchEvents) {
        return;
      }

      excludedDatesHidden.dispatchEvent(new Event("input", { bubbles: true }));
      excludedDatesHidden.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function addExcludedDate() {
      if (!excludedDateInput) {
        return;
      }

      const value = normalizeIsoDateInput(excludedDateInput.value);
      if (!value) {
        excludedDateInput.focus();
        return;
      }

      const dates = Array.from(new Set([...getExcludedDates(), value])).sort();
      excludedDateInput.value = "";
      setExcludedDates(dates);
    }

    function getDashboardState() {
      const countdownData = {
        alertChannelId: getValue("countdownAlertChannelId"),
        alertChannelLabel: getSelectedOptionLabel("countdownAlertChannelId", "Not selected"),
        alertEnabled: isChecked("countdownAlertEnabled"),
        alertTime: normalizeCountdownAlertTime(getValue("countdownAlertTime")),
        alertTimeZone: normalizeCountdownAlertTimeZone(getValue("countdownAlertTimeZone")),
        enabled: isChecked("countdownEnabled"),
        excludedDates: getExcludedDates(),
        mode: normalizeCountdownMode(getValue("countdownMode")),
        targetDate: normalizeIsoDateInput(getValue("countdownTargetDate")),
        title: getValue("countdownTitle"),
        weekdays: normalizeWeekdaySelection(getValues("countdownWeekdays")),
      };
      const countdownPreview = calculateCountdownPreview(countdownData);
      const countdownAlertPreview = calculateCountdownAlertPreview(
        countdownData,
        countdownPreview,
      );
      const welcomeEnabled = isChecked("welcomeEnabled");
      const autoRoleEnabled = isChecked("autoRoleEnabled");
      const auditLogEnabled = isChecked("auditLogEnabled");
      const autoModerationEnabled = isChecked("autoModerationEnabled");
      const joinScreeningEnabled = isChecked("joinScreeningEnabled");
      const announcementsEnabled = isChecked("announcementsEnabled");
      const starboardEnabled = isChecked("starboardEnabled");
      const suggestionsEnabled = isChecked("suggestionsEnabled");
      const welcomeChannelId = getValue("welcomeChannelId");
      const welcomeMessage = getValue("welcomeMessageTemplate");
      const autoRoleRoleId = getValue("autoRoleRoleId");
      const auditLogChannelId = getValue("auditLogChannelId");
      const auditLogEvents = [
        isChecked("auditLogMemberJoinEnabled"),
        isChecked("auditLogMemberLeaveEnabled"),
        isChecked("auditLogMessageDeleteEnabled"),
        isChecked("auditLogRoleChangeEnabled"),
      ].filter(Boolean).length;
      const autoModerationBlockedWords = safeText(getValue("autoModerationBlockedWords"));
      const autoModerationMentionLimit = Number.parseInt(getValue("autoModerationMentionLimit"), 10) || 0;
      const autoModerationBlockInvites = isChecked("autoModerationBlockInvites");
      const joinScreeningAlertChannelId = getValue("joinScreeningAlertChannelId");
      const joinScreeningAction = getValue("joinScreeningAction") || "flag";
      const joinScreeningQuarantineRoleId = getValue("joinScreeningQuarantineRoleId");
      const announcementsChannelId = getValue("announcementsChannelId");
      const starboardChannelId = getValue("starboardChannelId");
      const suggestionsChannelId = getValue("suggestionsChannelId");
      const modules = {
        ...getStaticModuleState(),
        announcements: {
          blocker: "",
          enabled: announcementsEnabled,
          state: "disabled",
        },
        auditLog: {
          blocker: "",
          enabled: auditLogEnabled,
          state: "disabled",
        },
        autoModeration: {
          blocker: "",
          enabled: autoModerationEnabled,
          state: "disabled",
        },
        autoRole: {
          blocker: "",
          enabled: autoRoleEnabled,
          state: "disabled",
        },
        countdown: {
          blocker: "",
          enabled: countdownData.enabled,
          state: "disabled",
        },
        joinScreening: {
          blocker: "",
          enabled: joinScreeningEnabled,
          state: "disabled",
        },
        starboard: {
          blocker: "",
          enabled: starboardEnabled,
          state: "disabled",
        },
        suggestions: {
          blocker: "",
          enabled: suggestionsEnabled,
          state: "disabled",
        },
        welcome: {
          blocker: "",
          enabled: welcomeEnabled,
          state: "disabled",
        },
      };

      if (countdownData.enabled) {
        modules.countdown.state = mapCountdownStateToStatus(countdownPreview.state);
        if (!countdownData.title || !countdownData.targetDate) {
          modules.countdown.blocker = "Add an event name and target date to finish setup.";
          modules.countdown.state = "incomplete";
        } else if (countdownData.alertEnabled && !countdownData.alertChannelId) {
          modules.countdown.blocker = "Select a countdown alert channel before enabling daily alerts.";
          modules.countdown.state = "incomplete";
        }
      }

      if (welcomeEnabled) {
        modules.welcome.state = "live";
        if (!welcomeChannelId) {
          modules.welcome.blocker = "Choose a welcome channel to finish setup.";
          modules.welcome.state = "incomplete";
        } else if (!welcomeMessage) {
          modules.welcome.blocker = "Add a welcome message to finish setup.";
          modules.welcome.state = "incomplete";
        }
      }

      if (autoRoleEnabled) {
        modules.autoRole.state = "live";
        if (!autoRoleRoleId) {
          modules.autoRole.blocker = "Select a default role to finish setup.";
          modules.autoRole.state = "incomplete";
        }
      }

      if (auditLogEnabled) {
        modules.auditLog.state = "live";
        if (!auditLogChannelId) {
          modules.auditLog.blocker = "Choose an audit log channel to finish setup.";
          modules.auditLog.state = "incomplete";
        } else if (auditLogEvents === 0) {
          modules.auditLog.blocker = "Choose at least one tracked audit event.";
          modules.auditLog.state = "incomplete";
        }
      }

      if (autoModerationEnabled) {
        modules.autoModeration.state = "live";
        const hasAutomodRule =
          autoModerationBlockInvites || autoModerationMentionLimit > 0 || Boolean(autoModerationBlockedWords);
        if (!hasAutomodRule) {
          modules.autoModeration.blocker = "Turn on at least one automod rule to finish setup.";
          modules.autoModeration.state = "incomplete";
        }
      }

      if (joinScreeningEnabled) {
        modules.joinScreening.state = "live";
        if (!joinScreeningAlertChannelId) {
          modules.joinScreening.blocker = "Choose an alert channel to finish setup.";
          modules.joinScreening.state = "incomplete";
        } else if (joinScreeningAction === "quarantine" && !joinScreeningQuarantineRoleId) {
          modules.joinScreening.blocker = "Select a quarantine role to finish setup.";
          modules.joinScreening.state = "incomplete";
        }
      }

      if (announcementsEnabled) {
        modules.announcements.state = "live";
        if (!announcementsChannelId) {
          modules.announcements.blocker = "Choose an announcement channel to finish setup.";
          modules.announcements.state = "incomplete";
        }
      }

      if (starboardEnabled) {
        modules.starboard.state = "live";
        if (!starboardChannelId) {
          modules.starboard.blocker = "Choose a highlight channel to finish setup.";
          modules.starboard.state = "incomplete";
        }
      }

      if (suggestionsEnabled) {
        modules.suggestions.state = "live";
        if (!suggestionsChannelId) {
          modules.suggestions.blocker = "Choose a suggestions channel to finish setup.";
          modules.suggestions.state = "incomplete";
        }
      }

      const enabledModules = Object.values(modules).filter((module) => module.enabled).length;
      const attentionModules = Object.values(modules).filter(
        (module) => module.enabled && module.state === "incomplete",
      ).length;

      return {
        attentionModules,
        countdownAlertPreview,
        countdownPreview,
        enabledModules,
        helloEnabled: isChecked("helloEnabled"),
        modules,
      };
    }

    function syncStatusPill(key, state) {
      const target = document.querySelector(`[data-status-target="${key}"]`);
      if (!target) {
        return;
      }

      target.className = `status-pill status-pill-${state}`;
      target.textContent = getStatusLabel(key, state);
    }

    function getModuleNavigationSummary(module) {
      if (!module.enabled) {
        return "Currently off. Enable it when this server is ready to use it.";
      }

      if (module.blocker) {
        return module.blocker;
      }

      if (module.state === "today") {
        return "Configured and currently active today.";
      }

      if (module.state === "ended") {
        return "Configured, but the current setup has already finished.";
      }

      return "Configured and ready for this server.";
    }

    function syncModuleNavigationCard(key, module) {
      const navCard = document.querySelector(`[data-module-nav="${key}"]`);
      if (navCard) {
        navCard.className = `module-index-item module-index-item-${module.state} ${module.blocker ? "is-alert" : ""}`;
        navCard.setAttribute("data-module-blocker", module.blocker || "");
        navCard.setAttribute("data-module-enabled", module.enabled ? "true" : "false");
        navCard.setAttribute("data-module-state", module.state);
        navCard.title = getModuleNavigationSummary(module);
        navCard.setAttribute(
          "aria-label",
          `${getModuleLabel(key)}: ${getStatusLabel(key, module.state)}. ${getModuleNavigationSummary(module)}`,
        );
      }

      const navPill = document.querySelector(`[data-module-nav-pill="${key}"]`);
      if (navPill) {
        navPill.className = `status-pill status-pill-${module.state}`;
        navPill.textContent = getStatusLabel(key, module.state);
      }

      const navMeta = document.querySelector(`[data-module-nav-meta="${key}"]`);
      if (navMeta) {
        navMeta.textContent = getModuleNavigationMeta(module);
      }

      syncModuleLibraryFilter();
    }

    function getFirstBlockedModuleKey(moduleState) {
      return Object.entries(moduleState.modules)
        .find(([, module]) => module.blocker)?.[0] || "";
    }

    function syncSetupRail(moduleState) {
      const firstBlockedKey = getFirstBlockedModuleKey(moduleState);
      const firstBlockedModule = firstBlockedKey ? moduleState.modules[firstBlockedKey] : null;

      if (setupRail) {
        setupRail.classList.toggle("has-issues", moduleState.attentionModules > 0);
        setupRail.classList.toggle("is-clear", moduleState.attentionModules === 0);
      }

      if (setupIssueCount) {
        setupIssueCount.textContent = moduleState.attentionModules > 0
          ? `${moduleState.attentionModules} issue${moduleState.attentionModules === 1 ? "" : "s"}`
          : "All configured";
      }

      if (nextIssueLabel) {
        nextIssueLabel.textContent = firstBlockedModule
          ? `Resolve ${getModuleLabel(firstBlockedKey)} next`
          : "All enabled modules are configured";
      }

      if (nextIssueCopy) {
        nextIssueCopy.textContent = firstBlockedModule
          ? firstBlockedModule.blocker
          : "Use the module shortcuts below to review settings, make edits, and save when you are ready.";
      }

      if (validationLead) {
        validationLead.textContent = firstBlockedModule
          ? `Start with ${getModuleLabel(firstBlockedKey)}: ${firstBlockedModule.blocker}`
          : "Every enabled module is configured.";
      }
    }

    function syncValidationSummary(moduleState) {
      if (!validationSummary || !validationList) {
        return;
      }

      const items = Object.entries(moduleState.modules)
        .filter(([, module]) => module.blocker)
        .map(([key, module]) => `
          <li>
            <a
              class="validation-link"
              href="#${escapeHtml(getModuleSectionId(key))}"
              data-jump-module="${escapeHtml(getModuleSectionId(key))}"
            >
              ${escapeHtml(getModuleLabel(key))}
            </a>
            <span>${escapeHtml(module.blocker)}</span>
          </li>
        `);

      validationList.innerHTML = items.join("");
      validationSummary.classList.toggle("is-hidden", items.length === 0);
    }

    function syncModuleDiagnostics(moduleState) {
      Object.entries(moduleState.modules).forEach(([key, module]) => {
        const blocker = document.querySelector(`[data-module-blocker="${key}"]`);
        if (blocker) {
          blocker.textContent = module.blocker;
          blocker.classList.toggle("is-hidden", !module.blocker);
        }

        syncStatusPill(key, module.state);
        syncModuleNavigationCard(key, module);
      });

      if (overviewEnabled) {
        overviewEnabled.textContent = String(moduleState.enabledModules);
      }
      if (overviewAttention) {
        overviewAttention.textContent = String(moduleState.attentionModules);
      }
      if (overviewHello) {
        overviewHello.textContent = moduleState.helloEnabled ? "Live" : "Disabled";
      }

      syncSetupRail(moduleState);
      syncValidationSummary(moduleState);
      reviewIssueButtons.forEach((button) => {
        button.classList.toggle("is-hidden", moduleState.attentionModules === 0);
      });
      expandIssueButtons.forEach((button) => {
        button.classList.toggle("is-hidden", moduleState.attentionModules === 0);
      });
    }

    function syncCountdownPreview(previewState) {
      if (countdownPreviewNode) {
        countdownPreviewNode.innerHTML = escapeHtml(previewState.countdownPreview.commandPreview)
          .replaceAll("\n", "<br />");
      }
      if (countdownModeLabel) {
        countdownModeLabel.textContent = previewState.countdownPreview.modeLabel;
      }
      if (countdownStatusLabel) {
        countdownStatusLabel.textContent = getCountdownStatusLabel(previewState.countdownPreview.state);
      }
      if (countdownTargetLabel) {
        countdownTargetLabel.textContent = previewState.countdownPreview.targetDateLabel || "Not set";
      }
      if (countdownMetaLine) {
        countdownMetaLine.textContent = previewState.countdownPreview.metaLine;
      }

      syncOptionalPreviewLine(countdownScheduleLine, previewState.countdownPreview.scheduleLine);
      syncOptionalPreviewLine(countdownBreakdownLine, previewState.countdownPreview.breakdownLine);
      syncOptionalPreviewLine(
        countdownIgnoredLine,
        previewState.countdownPreview.ignoredExclusionsLine,
      );

      if (countdownAlertStatus) {
        countdownAlertStatus.className = `status-pill status-pill-${previewState.countdownAlertPreview.state}`;
        countdownAlertStatus.textContent = getAlertStatusLabel(previewState.countdownAlertPreview.state);
      }
      if (countdownAlertPreviewNode) {
        countdownAlertPreviewNode.innerHTML = escapeHtml(previewState.countdownAlertPreview.preview)
          .replaceAll("\n", "<br />");
      }
      if (countdownAlertChannelLabel) {
        countdownAlertChannelLabel.textContent = previewState.countdownAlertPreview.channelLabel;
      }
      if (countdownAlertTimeLabel) {
        countdownAlertTimeLabel.textContent = previewState.countdownAlertPreview.timeLabel;
      }
      if (countdownAlertNote) {
        countdownAlertNote.textContent = previewState.countdownAlertPreview.note;
      }
      if (countdownAlertTimeCopy) {
        countdownAlertTimeCopy.textContent = previewState.countdownAlertPreview.timeHelpText;
      }
    }

    function syncSaveBar() {
      const snapshot = serializeForm(form);
      const currentFieldState = getFieldStateSnapshot();
      const changedFieldNames = getChangedFieldNames(currentFieldState);
      const changedFieldCount = changedFieldNames.length;
      const changedScopeCount = countChangedScopes(changedFieldNames);
      const effectiveScopeCount = changedScopeCount || 1;
      const dashboardState = getDashboardState();
      isDirty = snapshot !== initialSnapshot;

      if (saveBar) {
        saveBar.classList.toggle("is-dirty", isDirty);
        saveBar.classList.toggle("has-issues", dashboardState.attentionModules > 0);
      }

      if (saveButton) {
        saveButton.disabled = !isDirty;
      }

      if (discardButton) {
        discardButton.disabled = !isDirty;
      }

      if (saveTitle) {
        if (isDirty && dashboardState.attentionModules > 0) {
          saveTitle.textContent = "Unsaved changes with blockers";
        } else {
          saveTitle.textContent = isDirty ? "Unsaved changes" : "All changes saved";
        }
      }

      if (saveStatus) {
        if (isDirty && dashboardState.attentionModules > 0) {
          saveStatus.textContent = `${changedFieldCount} field${changedFieldCount === 1 ? "" : "s"} changed across ${effectiveScopeCount} area${effectiveScopeCount === 1 ? "" : "s"}. ${dashboardState.attentionModules} enabled module${dashboardState.attentionModules === 1 ? "" : "s"} still need setup before save.`;
        } else if (isDirty) {
          saveStatus.textContent = `${changedFieldCount} field${changedFieldCount === 1 ? "" : "s"} changed across ${effectiveScopeCount} area${effectiveScopeCount === 1 ? "" : "s"}. Save when you are ready; these changes only affect this server.`;
        } else {
          saveStatus.textContent = "Changes only apply to this server after you save them.";
        }
      }

      syncModuleDiagnostics(dashboardState);
      syncCountdownPreview(dashboardState);
    }

    renderExcludedDates();

    if (excludedDateAddButton) {
      excludedDateAddButton.addEventListener("click", addExcludedDate);
    }
    if (excludedDateInput) {
      excludedDateInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }

        event.preventDefault();
        addExcludedDate();
      });
    }
    if (excludedDateList) {
      excludedDateList.addEventListener("click", (event) => {
        const button = event.target.closest("[data-excluded-date-chip]");
        if (!button) {
          return;
        }

        const isoDate = safeText(button.getAttribute("data-iso-date"));
        if (!isoDate) {
          return;
        }

        setExcludedDates(getExcludedDates().filter((date) => date !== isoDate));
      });
    }

    reviewIssueButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const firstBlockedKey = getFirstBlockedModuleKey(getDashboardState());
        if (!firstBlockedKey) {
          return;
        }

        openModuleCardById(getModuleSectionId(firstBlockedKey));
      });
    });

    expandIssueButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const moduleState = getDashboardState();
        Object.entries(moduleState.modules)
          .filter(([, module]) => module.blocker)
          .forEach(([key]) => {
            const card = document.getElementById(getModuleSectionId(key));
            if (card) {
              setModuleCardOpen(card, true);
            }
          });

        const firstBlockedKey = getFirstBlockedModuleKey(moduleState);
        if (firstBlockedKey) {
          openModuleCardById(getModuleSectionId(firstBlockedKey));
        }
      });
    });

    form.addEventListener("input", syncSaveBar);
    form.addEventListener("change", syncSaveBar);
    form.addEventListener("reset", () => {
      window.requestAnimationFrame(() => {
        const modeField = getField("countdownMode");
        const alertToggle = getField("countdownAlertEnabled");
        if (modeField) {
          modeField.dispatchEvent(new Event("change", { bubbles: true }));
        }
        if (alertToggle) {
          alertToggle.dispatchEvent(new Event("change", { bubbles: true }));
        }
        renderExcludedDates();
        syncSaveBar();
      });
    });
    form.addEventListener("submit", () => {
      isDirty = false;
      if (saveTitle) {
        saveTitle.textContent = "Saving changes";
      }
      if (saveStatus) {
        saveStatus.textContent = "Blueprint is saving this server configuration now.";
      }
      if (saveButton) {
        saveButton.disabled = true;
      }
      if (discardButton) {
        discardButton.disabled = true;
      }
    });

    window.addEventListener("beforeunload", (event) => {
      if (!isDirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    });

    syncSaveBar();
  }

  function serializeForm(form) {
    const entries = Array.from(new FormData(form).entries())
      .map(([key, value]) => [key, String(value)])
      .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
        if (leftKey === rightKey) {
          return leftValue.localeCompare(rightValue);
        }

        return leftKey.localeCompare(rightKey);
      });

    return JSON.stringify(entries);
  }

  function normalizeCountdownMode(value) {
    return value === "active-days" ? "active-days" : "calendar";
  }

  function normalizeIsoDateInput(value) {
    const raw = safeText(value);
    if (!raw) {
      return "";
    }

    return parseIsoDate(raw) ? raw : "";
  }

  function normalizeWeekdaySelection(values) {
    const weekdays = Array.from(
      new Set(
        (Array.isArray(values) ? values : [values])
          .map((value) => Number.parseInt(String(value), 10))
          .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6),
      ),
    ).sort((left, right) => left - right);

    return weekdays.length ? weekdays : [...DEFAULT_WEEKDAYS];
  }

  function normalizeCountdownAlertTime(value) {
    const raw = safeText(value);
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(raw) ? raw : "09:00";
  }

  function normalizeCountdownAlertTimeZone(value) {
    const raw = safeText(value);
    if (!raw) {
      return "UTC";
    }

    try {
      new Intl.DateTimeFormat("en-US", { timeZone: raw }).format(new Date());
      return raw;
    } catch {
      return "UTC";
    }
  }

  function normalizeExcludedDatesValue(value) {
    const tokens = String(value || "")
      .split(/[\s,]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    return Array.from(new Set(tokens.map(normalizeIsoDateInput).filter(Boolean))).sort();
  }

  function parseIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
      return null;
    }

    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toISOString().slice(0, 10) === value ? parsed : null;
  }

  function formatDateLabel(value) {
    const parsed = typeof value === "string" ? parseIsoDate(value) : value;
    return parsed ? dateLabelFormatter.format(parsed) : "";
  }

  function formatExcludedDateChipLabel(value) {
    return formatDateLabel(value) || value;
  }

  function renderExcludedDateChips(dates) {
    return dates
      .map((isoDate) => `
        <button
          class="date-chip"
          type="button"
          data-excluded-date-chip
          data-iso-date="${escapeHtml(isoDate)}"
        >
          <span>${escapeHtml(formatExcludedDateChipLabel(isoDate))}</span>
          <span aria-hidden="true">Remove</span>
        </button>
      `)
      .join("");
  }

  function calculateCountdownPreview(data) {
    const enabled = Boolean(data.enabled);
    const title = safeText(data.title);
    const targetDate = normalizeIsoDateInput(data.targetDate);
    const mode = normalizeCountdownMode(data.mode);
    const weekdays = normalizeWeekdaySelection(data.weekdays);
    const excludedDates = normalizeExcludedDatesValue(data.excludedDates);

    if (!enabled) {
      return {
        breakdownLine: "",
        commandPreview: "The countdown feature is disabled in this server.",
        excludedDates,
        ignoredExclusionsLine: "",
        metaLine: "Turn the feature on to make /countdown available.",
        mode,
        modeLabel: mode === "calendar" ? "Calendar days" : "Selected weekdays",
        scheduleLine: "",
        state: "disabled",
        targetDateLabel: "",
        title,
      };
    }

    if (!title || !targetDate) {
      return {
        breakdownLine: "",
        commandPreview: "This server's countdown is not fully configured yet.",
        excludedDates,
        ignoredExclusionsLine: "",
        metaLine: "Add an event name and a target date to finish setup.",
        mode,
        modeLabel: mode === "calendar" ? "Calendar days" : "Selected weekdays",
        scheduleLine: buildScheduleLine(mode, weekdays, null, excludedDates.length),
        state: "incomplete",
        targetDateLabel: targetDate ? formatDateLabel(targetDate) : "",
        title,
      };
    }

    const today = getStartOfCurrentDate(new Date(), normalizeCountdownAlertTimeZone(data.alertTimeZone));
    const target = parseIsoDate(targetDate);
    const targetDateLabel = formatDateLabel(targetDate);
    const differenceInDays = getDayDifference(today, target);
    const activeDayBreakdown = mode === "active-days"
      ? analyzeActiveDayCountdown(today, target, weekdays, excludedDates)
      : null;

    if (differenceInDays < 0) {
      return {
        breakdownLine: "",
        commandPreview: `${title} was on ${targetDateLabel}.`,
        excludedDates,
        ignoredExclusionsLine: "",
        metaLine: "This countdown has already ended.",
        mode,
        modeLabel: mode === "calendar" ? "Calendar days" : "Selected weekdays",
        scheduleLine: buildScheduleLine(mode, weekdays, activeDayBreakdown),
        state: "past",
        targetDateLabel,
        title,
      };
    }

    if (differenceInDays === 0) {
      return {
        breakdownLine: "",
        commandPreview: `${title} is happening today.`,
        excludedDates,
        ignoredExclusionsLine: "",
        metaLine: `Target date: ${targetDateLabel}`,
        mode,
        modeLabel: mode === "calendar" ? "Calendar days" : "Selected weekdays",
        scheduleLine: buildScheduleLine(mode, weekdays, activeDayBreakdown),
        state: "today",
        targetDateLabel,
        title,
      };
    }

    const remaining = mode === "calendar" ? differenceInDays : activeDayBreakdown.remaining;
    const unitLabel = mode === "calendar"
      ? `calendar ${remaining === 1 ? "day" : "days"}`
      : `${remaining === 1 ? "selected day" : "selected days"}`;
    const scheduleLine = buildScheduleLine(mode, weekdays, activeDayBreakdown, excludedDates.length);
    const breakdownLine = buildBreakdownLine(mode, activeDayBreakdown);
    const ignoredExclusionsLine = buildIgnoredExclusionsLine(mode, activeDayBreakdown);

    return {
      breakdownLine,
      commandPreview: [
        `${remaining} ${unitLabel} until ${title}`,
        `Target date: ${targetDateLabel}`,
        scheduleLine,
        breakdownLine,
        ignoredExclusionsLine,
      ].filter(Boolean).join("\n"),
      excludedDates,
      ignoredExclusionsLine,
      metaLine:
        mode === "calendar"
          ? "Every calendar day is included."
          : "Only selected weekdays after today and before the target date are counted. Excluded dates only reduce the total when they land on one of those counted days.",
      mode,
      modeLabel: mode === "calendar" ? "Calendar days" : "Selected weekdays",
      remaining,
      remainingLabel: `${remaining} ${unitLabel}`,
      scheduleLine,
      state: "upcoming",
      targetDateLabel,
      title,
    };
  }

  function calculateCountdownAlertPreview(data, countdownPreview) {
    const state = !data.alertEnabled
      ? "disabled"
      : !data.enabled || !data.title || !data.targetDate || !data.alertChannelId
        ? "incomplete"
        : "live";
    const timing = getAlertTiming(data.alertTime, data.alertTimeZone);

    return {
      channelLabel: data.alertChannelLabel,
      note: getCountdownAlertNote(data, countdownPreview, state, timing.timeLabel),
      preview:
        state === "live"
          ? buildCountdownAlertPreviewMessage(countdownPreview)
          : "Daily alerts stay off until the countdown module is enabled and fully configured.",
      state,
      timeHelpText: timing.timeHelpText,
      timeLabel: timing.timeLabel,
    };
  }

  function buildCountdownAlertPreviewMessage(countdownPreview) {
    if (countdownPreview.state === "today") {
      return `**${countdownPreview.title}**\nHappening today`;
    }

    if (countdownPreview.state !== "upcoming") {
      return countdownPreview.commandPreview;
    }

    return `**${countdownPreview.title}**\n${getCountdownAlertDeliveryLine(countdownPreview)} | ${countdownPreview.targetDateLabel}`;
  }

  function getAlertTiming(alertTime, timeZone) {
    const localTimeLabel = normalizeCountdownAlertTime(alertTime);
    const normalizedTimeZone = normalizeCountdownAlertTimeZone(timeZone);
    const dueAtUtc = getUtcDateForTimeZoneLocalTime(
      new Date(),
      normalizedTimeZone,
      localTimeLabel,
    );
    const utcTimeLabel = dueAtUtc
      ? formatTimeLabel(dueAtUtc.getUTCHours(), dueAtUtc.getUTCMinutes())
      : localTimeLabel;
    const timeLabel = normalizedTimeZone === "UTC"
      ? `${utcTimeLabel} UTC`
      : `${localTimeLabel} ${normalizedTimeZone} / ${utcTimeLabel} UTC`;
    const timeHelpText = normalizedTimeZone === "UTC"
      ? `Posts daily at ${utcTimeLabel} UTC.`
      : `Posts daily at ${localTimeLabel} ${normalizedTimeZone}, which is ${utcTimeLabel} UTC right now.`;

    return {
      timeHelpText,
      timeLabel,
      timeZone: normalizedTimeZone,
    };
  }

  function getCountdownAlertNote(data, countdownPreview, state, timeLabel) {
    if (state === "disabled") {
      return "";
    }

    if (state === "incomplete") {
      return data.enabled && data.title && data.targetDate
        ? "Choose a channel and send time."
        : "Finish the countdown setup first.";
    }

    if (countdownPreview.state === "past") {
      return "Alerts stop after the target date.";
    }

    const deliveryTarget =
      data.alertChannelLabel && data.alertChannelLabel !== "Not selected"
        ? data.alertChannelLabel
        : "the selected channel";
    return `Posts in ${deliveryTarget} at ${timeLabel}.`;
  }

  function getCountdownAlertDeliveryLine(countdownPreview) {
    const remaining = Number(countdownPreview.remaining);
    if (!Number.isFinite(remaining)) {
      return "Countdown update";
    }

    if (countdownPreview.mode === "active-days") {
      return `${remaining} ${remaining === 1 ? "counted day" : "counted days"} left`;
    }

    return `${remaining} ${remaining === 1 ? "day" : "days"} left`;
  }

  function mapCountdownStateToStatus(state) {
    if (state === "upcoming") {
      return "live";
    }

    if (state === "today") {
      return "today";
    }

    if (state === "past") {
      return "ended";
    }

    if (state === "incomplete") {
      return "incomplete";
    }

    return "disabled";
  }

  function getCountdownStatusLabel(state) {
    if (state === "upcoming") {
      return "Live";
    }

    if (state === "today") {
      return "Today";
    }

    if (state === "past") {
      return "Ended";
    }

    if (state === "incomplete") {
      return "Needs setup";
    }

    return "Disabled";
  }

  function getAlertStatusLabel(state) {
    return state === "live" ? "Live" : state === "incomplete" ? "Needs setup" : "Disabled";
  }

  function syncOptionalPreviewLine(node, text) {
    if (!node) {
      return;
    }

    node.textContent = text || "";
    node.classList.toggle("is-hidden", !text);
  }

  function formatWeekdayList(weekdays) {
    return normalizeWeekdaySelection(weekdays)
      .map((weekday) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][weekday])
      .join(", ");
  }

  function analyzeActiveDayCountdown(today, target, weekdays, excludedDates) {
    const allowedWeekdays = new Set(normalizeWeekdaySelection(weekdays));
    const normalizedExcludedDates = normalizeExcludedDatesValue(excludedDates.join(","));
    const excluded = new Set(normalizedExcludedDates);
    const effectiveExcludedDates = [];
    const ignoredExcludedDates = [];
    let eligibleDayCount = 0;
    let remaining = 0;

    normalizedExcludedDates.forEach((isoDate) => {
      const reason = getIgnoredExclusionReason(isoDate, today, target, allowedWeekdays);
      if (reason) {
        ignoredExcludedDates.push({ isoDate, reason });
        return;
      }

      effectiveExcludedDates.push(isoDate);
    });

    for (let cursor = addDays(today, 1); cursor < target; cursor = addDays(cursor, 1)) {
      const isoDate = cursor.toISOString().slice(0, 10);
      if (!allowedWeekdays.has(cursor.getUTCDay())) {
        continue;
      }

      eligibleDayCount += 1;
      if (!excluded.has(isoDate)) {
        remaining += 1;
      }
    }

    return {
      effectiveExcludedCount: effectiveExcludedDates.length,
      eligibleDayCount,
      ignoredExcludedCount: ignoredExcludedDates.length,
      ignoredExcludedDates,
      remaining,
    };
  }

  function buildScheduleLine(mode, weekdays, activeDayBreakdown, enteredExcludedCount) {
    if (mode !== "active-days") {
      return "";
    }

    const parts = [`Counting: ${formatWeekdayList(weekdays)}`];
    if (!activeDayBreakdown) {
      if (enteredExcludedCount > 0) {
        parts.push(`Entered exclusions: ${enteredExcludedCount} ${enteredExcludedCount === 1 ? "date" : "dates"}`);
      }

      return parts.join(" | ");
    }

    if (activeDayBreakdown.effectiveExcludedCount > 0) {
      parts.push(
        `Effective exclusions: ${activeDayBreakdown.effectiveExcludedCount} ${activeDayBreakdown.effectiveExcludedCount === 1 ? "date" : "dates"}`,
      );
    }

    if (activeDayBreakdown.ignoredExcludedCount > 0) {
      parts.push(
        `Ignored exclusions: ${activeDayBreakdown.ignoredExcludedCount} ${activeDayBreakdown.ignoredExcludedCount === 1 ? "date" : "dates"}`,
      );
    }

    return parts.join(" | ");
  }

  function buildBreakdownLine(mode, activeDayBreakdown) {
    if (mode !== "active-days" || !activeDayBreakdown) {
      return "";
    }

    return `Weekdays in range: ${activeDayBreakdown.eligibleDayCount} | Removed by exclusions: ${activeDayBreakdown.effectiveExcludedCount} | Final countdown: ${activeDayBreakdown.remaining}`;
  }

  function buildIgnoredExclusionsLine(mode, activeDayBreakdown) {
    if (mode !== "active-days" || !activeDayBreakdown || activeDayBreakdown.ignoredExcludedCount === 0) {
      return "";
    }

    const summarizedDates = activeDayBreakdown.ignoredExcludedDates
      .slice(0, 3)
      .map(({ isoDate, reason }) => `${isoDate} (${reason})`)
      .join(", ");
    const remainingCount = activeDayBreakdown.ignoredExcludedCount - 3;
    const suffix = remainingCount > 0 ? `, plus ${remainingCount} more` : "";

    return `Ignored excluded dates: ${summarizedDates}${suffix}`;
  }

  function getIgnoredExclusionReason(isoDate, today, target, allowedWeekdays) {
    const excludedDate = parseIsoDate(isoDate);
    if (!excludedDate) {
      return "invalid date";
    }

    if (excludedDate <= today) {
      return "on or before today";
    }

    if (excludedDate >= target) {
      return "on or after target date";
    }

    if (!allowedWeekdays.has(excludedDate.getUTCDay())) {
      return "weekday not selected";
    }

    return "";
  }

  function getCurrentIsoDateInTimeZone(value, timeZone) {
    const parts = getZonedDateParts(value, normalizeCountdownAlertTimeZone(timeZone));
    return `${parts.year}-${padNumber(parts.month)}-${padNumber(parts.day)}`;
  }

  function getStartOfCurrentDate(value, timeZone) {
    const isoDate = getCurrentIsoDateInTimeZone(value, timeZone);
    return parseIsoDate(isoDate) || new Date(Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
    ));
  }

  function getUtcDateForTimeZoneLocalTime(referenceDate, timeZone, timeLabel) {
    const [hours, minutes] = normalizeCountdownAlertTime(timeLabel).split(":");
    const parts = getZonedDateParts(referenceDate, normalizeCountdownAlertTimeZone(timeZone));
    const desiredAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      Number.parseInt(hours, 10),
      Number.parseInt(minutes, 10),
    );
    let guess = new Date(desiredAsUtc);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const guessParts = getZonedDateParts(guess, normalizeCountdownAlertTimeZone(timeZone));
      const actualAsUtc = Date.UTC(
        guessParts.year,
        guessParts.month - 1,
        guessParts.day,
        guessParts.hour,
        guessParts.minute,
      );
      const delta = desiredAsUtc - actualAsUtc;
      if (delta === 0) {
        break;
      }

      guess = new Date(guess.getTime() + delta);
    }

    return guess;
  }

  function getZonedDateParts(value, timeZone) {
    const normalizedTimeZone = normalizeCountdownAlertTimeZone(timeZone);
    if (!zonedFormatterCache.has(normalizedTimeZone)) {
      zonedFormatterCache.set(
        normalizedTimeZone,
        new Intl.DateTimeFormat("en-CA", {
          day: "2-digit",
          hour: "2-digit",
          hourCycle: "h23",
          minute: "2-digit",
          month: "2-digit",
          timeZone: normalizedTimeZone,
          year: "numeric",
        }),
      );
    }

    const parts = zonedFormatterCache.get(normalizedTimeZone).formatToParts(value);
    const mapped = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );

    return {
      day: Number.parseInt(mapped.day, 10),
      hour: Number.parseInt(mapped.hour, 10),
      minute: Number.parseInt(mapped.minute, 10),
      month: Number.parseInt(mapped.month, 10),
      year: Number.parseInt(mapped.year, 10),
    };
  }

  function getDayDifference(start, end) {
    return Math.round((end.getTime() - start.getTime()) / 86400000);
  }

  function addDays(date, amount) {
    return new Date(date.getTime() + amount * 86400000);
  }

  function formatTimeLabel(hours, minutes) {
    return `${padNumber(hours)}:${padNumber(minutes)}`;
  }

  function padNumber(value) {
    return String(value).padStart(2, "0");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function bindLandingMotion() {
    const landingPage = document.querySelector(".landing-page");
    if (!landingPage) {
      return;
    }

    const revealGroups = [
      Array.from(landingPage.querySelectorAll(".landing-intro > *")),
      Array.from(landingPage.querySelectorAll(".landing-capability-card")),
      Array.from(landingPage.querySelectorAll(".landing-workflow-copy > *, .landing-steps li")),
      Array.from(landingPage.querySelectorAll(".landing-module-heading > *, .landing-module-list span")),
      Array.from(landingPage.querySelectorAll(".landing-closing > *:not(.landing-closing-glow)")),
    ];
    const revealItems = revealGroups.flat();
    const prefersReducedMotion = typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    landingPage.classList.add("landing-motion-ready");
    revealGroups.forEach((group) => {
      group.forEach((item, index) => {
        item.classList.add("landing-reveal");
        item.style.setProperty("--landing-reveal-delay", `${Math.min(index * 70, 420)}ms`);
      });
    });

    const reveal = (item) => item.classList.add("is-visible");
    if (prefersReducedMotion || typeof window.IntersectionObserver !== "function") {
      revealItems.forEach(reveal);
    } else {
      const observer = new window.IntersectionObserver((entries, activeObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          reveal(entry.target);
          activeObserver.unobserve(entry.target);
        });
      }, {
        rootMargin: "0px 0px -8% 0px",
        threshold: 0.14,
      });

      revealItems.forEach((item) => observer.observe(item));
    }

    if (prefersReducedMotion || typeof window.matchMedia !== "function") {
      return;
    }

    const supportsPointerTilt = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const scene = landingPage.querySelector(".landing-console");
    const consoleWindow = scene?.querySelector(".console-window");
    if (!supportsPointerTilt || !scene || !consoleWindow) {
      return;
    }

    scene.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") {
        return;
      }

      const bounds = scene.getBoundingClientRect();
      const horizontal = (event.clientX - bounds.left) / bounds.width - 0.5;
      const vertical = (event.clientY - bounds.top) / bounds.height - 0.5;
      consoleWindow.style.setProperty("--console-tilt-x", `${(horizontal * 6).toFixed(2)}deg`);
      consoleWindow.style.setProperty("--console-tilt-y", `${(vertical * -5).toFixed(2)}deg`);
      scene.classList.add("is-pointer-active");
    });

    scene.addEventListener("pointerleave", () => {
      consoleWindow.style.setProperty("--console-tilt-x", "0deg");
      consoleWindow.style.setProperty("--console-tilt-y", "0deg");
      scene.classList.remove("is-pointer-active");
    });
  }

  async function handleAuthComplete() {
    const marker = document.querySelector("[data-auth-complete='true']");
    if (!marker) {
      return;
    }

    const returnTo = safeText(marker.getAttribute("data-return-to")) || "/dashboard";
    activeAuthReturnTo = returnTo;

    if (popupAuthHelper && (await popupAuthHelper.consumeRedirectResult())) {
      return;
    }

    try {
      await syncFromDashboard(returnTo);
    } catch (error) {
      marker.textContent =
        error.message || "No active Continental ID session was found. Use sign-in to continue.";
      showAuthFeedback(marker.textContent, "error");
    }
  }

  bindLandingMotion();
  bindLoginButtons();
  bindLinkDiscordButton();
  bindModuleCards();
  bindModuleJumpLinks();
  bindModuleLibraryFilter();
  bindCountdownControls();
  bindGuildSearchControls();
  bindSettingsFormUX();
  focusFlashNotice();
  handleAuthComplete();
})();
