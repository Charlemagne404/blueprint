const {
  COMMON_DAILY_ALERT_TIME_ZONES,
  DEFAULT_DAILY_ALERT_TIME_ZONE,
  getCountdownAlertStatusLabel,
  getCountdownAlertSummary,
  SUPPORTED_DAILY_ALERT_TIME_ZONES,
  WEEKDAY_OPTIONS,
  excludedDatesToTextarea,
  formatDateLabel,
  getCountdownResult,
} = require("./countdown");
const {
  escapeHtml,
  renderFeatureToggle,
  renderModuleCard,
  renderModuleFacts,
} = require("./html");
const config = require("./config");
const { renderAnnouncementModuleCard } = require("./modules/announcements");
const { renderAiToolsModuleCard } = require("./modules/ai-tools");
const { renderAntiRaidModuleCard } = require("./modules/anti-raid");
const { renderAuditLogModuleCard } = require("./modules/audit-log");
const { renderAutoModerationModuleCard } = require("./modules/auto-moderation");
const { renderAutoRoleModuleCard } = require("./modules/auto-role");
const { renderJoinScreeningModuleCard } = require("./modules/join-screening");
const { renderSuggestionModuleCard } = require("./modules/suggestions");
const { renderTicketModuleCard } = require("./modules/tickets");
const { renderStarboardModuleCard } = require("./modules/starboard");
const { renderWelcomeModuleCard } = require("./modules/welcome");
const { renderLevelingModuleCard } = require("./modules/leveling");
const { renderReactionRoleModuleCard } = require("./modules/reaction-roles");
const { renderAutomationModuleCard } = require("./modules/automations");
const { renderModmailModuleCard } = require("./modules/modmail");
const { renderApplicationsModuleCard } = require("./modules/applications");

const CONTACT_URL = "https://contact.continental-hub.com";

function renderLayout({
  authConfig,
  body,
  currentPath = "/",
  description = "Blueprint is a modular, dashboard-first Discord control center for configuring and operating servers cleanly.",
  ogType = "website",
  noindex = false,
  pageHeading = "",
  schema = [],
  sessionUser,
  title,
}) {
  const fallbackAvatar = "/images/C2-new-white.png";
  const canonicalUrl = buildCanonicalUrl(currentPath);
  const socialImageUrl = buildCanonicalUrl("/images/Blueprint-banner.png");
  const fullTitle = title.includes("Blueprint") ? title : `${title} | Blueprint`;
  const schemaMarkup = renderStructuredData([
    buildOrganizationSchema(),
    buildWebPageSchema({
      currentPath,
      description,
      pageHeading,
      title: fullTitle,
    }),
    ...schema,
  ]);
  const authButton = sessionUser
    ? `<a class="button button-ghost" href="/logout">Log out</a>`
    : `<button class="button button-ghost" id="login-button" type="button">Continue with Continental ID</button>`;

  const authMeta = sessionUser
    ? `<div class="user-chip">
        ${
          sessionUser.avatarUrl
            ? `<img src="${escapeHtml(sessionUser.avatarUrl)}" alt="" onerror="this.onerror=null;this.src='${fallbackAvatar}'" />`
            : `<img src="${fallbackAvatar}" alt="" />`
        }
        <span>${escapeHtml(sessionUser.username)}</span>
      </div>`
    : "";

  const topbarNav = `
    <nav class="topbar-nav" aria-label="Primary">
      <a href="/">Home</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
      <a href="${CONTACT_URL}" target="_blank" rel="noopener noreferrer">Contact</a>
    </nav>
  `;

  const footer = `
    <footer class="site-footer">
      <div class="site-footer-copy">
        <div class="site-footer-mark" aria-label="Made by Continental">
          <span>Made by</span>
          <img src="/images/made-by-continental-white.png" alt="Continental" />
        </div>
      </div>
      <nav class="site-footer-nav" aria-label="Footer">
        <a href="https://github.com/Charlemagne404" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="https://www.patreon.com/cw/ContinentalStudios" target="_blank" rel="noopener noreferrer">Patreon</a>
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms of Service</a>
        <a href="${CONTACT_URL}" target="_blank" rel="noopener noreferrer">Contact</a>
        <a href="/security.txt">Security</a>
      </nav>
    </footer>
  `;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0f172a" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="${noindex ? "noindex, nofollow" : "index, follow"}" />
    <meta name="author" content="Continental" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <title>${escapeHtml(fullTitle)}</title>
    <link rel="shortcut icon" href="/favicon.ico" />
    <link rel="icon" type="image/png" href="/images/blueprint-pfp2.png" />
    <link rel="apple-touch-icon" href="/images/blueprint-pfp2.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <meta property="og:type" content="${escapeHtml(ogType)}" />
    <meta property="og:site_name" content="Blueprint" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:title" content="${escapeHtml(fullTitle)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(socialImageUrl)}" />
    <meta property="og:image:alt" content="Blueprint control center preview" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(fullTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(socialImageUrl)}" />
    <meta name="twitter:image:alt" content="Blueprint control center preview" />
    <link rel="stylesheet" href="/styles.css" />
    ${schemaMarkup}
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to content</a>
    <div class="page-shell">
      <header class="topbar">
        <div class="topbar-branding">
          <a class="brand" href="/">
            <span class="brand-lockup">
              <span class="brand-mark">
                <img src="/images/blueprint-pfp2.png" alt="Blueprint" />
              </span>
              <span class="brand-copy">
                <span class="brand-title">Blueprint</span>
                <span class="brand-subtitle">Control Center</span>
              </span>
            </span>
          </a>
          <div class="maker-badge" aria-label="Made by Continental">
            <span class="maker-badge-label">Made by</span>
            <img src="/images/Continental-nobg-white.png" alt="Continental" />
          </div>
        </div>
        ${topbarNav}
        <div class="topbar-actions">
          ${authMeta}
          ${authButton}
        </div>
      </header>
      ${body}
      ${footer}
    </div>
    <script>
      window.BLUEPRINT_AUTH = ${JSON.stringify(authConfig)};
    </script>
    <script src="/vendor/continental-id-client.js"></script>
    <script src="/app.js"></script>
  </body>
</html>`;
}

function renderDashboardAction(action) {
  if (!action) {
    return "";
  }

  const className = action.variant === "ghost" ? "button button-ghost" : "button";
  if (action.type === "button") {
    return `
      <button
        class="${className}"
        ${action.id ? `id="${escapeHtml(action.id)}"` : ""}
        type="${escapeHtml(action.buttonType || "button")}"
      >
        ${escapeHtml(action.label)}
      </button>
    `;
  }

  return `
    <a
      class="${className}"
      href="${escapeHtml(action.href)}"
      ${action.newTab ? 'target="_blank" rel="noopener noreferrer"' : ""}
    >
      ${escapeHtml(action.label)}
    </a>
  `;
}

function getDashboardOnboardingState({
  addBotUrl,
  attentionServers = 0,
  discordLinked = false,
  guildCount = 0,
  sessionUser,
}) {
  const installedLabel = `${guildCount} installed server${guildCount === 1 ? "" : "s"}`;
  const attentionLabel = `${attentionServers} need setup`;

  if (!sessionUser) {
    return {
      dashboardCopy:
        "Sign in first, then link Discord and install Blueprint in a server you manage.",
      dashboardEyebrow: "Get started",
      dashboardTitle: "Open Blueprint by signing in first",
      headline: "Run Blueprint from one polished server dashboard.",
      key: "signed-out",
      lede:
        "Continue with Continental ID to unlock the dashboard, link Discord, and manage installed servers without burying staff inside long slash commands.",
      primaryAction: {
        id: "login-button",
        label: "Continue with Continental ID",
        type: "button",
      },
      progressLabel: "Start with sign-in",
      progressText: "Blueprint setup starts with your Continental ID session.",
      secondaryAction: {
        href: "/dashboard",
        label: "View installed servers",
        type: "link",
        variant: "ghost",
      },
      stats: [],
      steps: [
        { label: "Continue with Continental ID", status: "current", statusLabel: "Start" },
        { label: "Link the Discord account you use to manage servers", status: "pending", statusLabel: "Next" },
        { label: "Install Blueprint in a server and finish setup", status: "pending", statusLabel: "Later" },
      ],
    };
  }

  if (!discordLinked) {
    return {
      dashboardCopy:
        "Blueprint can only match you to manageable servers after the Discord account on your Continental ID profile is linked.",
      dashboardEyebrow: "Link Discord",
      dashboardTitle: "Link Discord before you load the server dashboard",
      headline: "Link Discord before you open server setup.",
      key: "discord-unlinked",
      lede:
        "Your Continental ID session is active. The next step is linking the Discord account tied to the servers you manage so Blueprint can load the right dashboard access.",
      primaryAction: {
        id: "connect-discord-button",
        label: "Link Discord",
        type: "button",
      },
      progressLabel: "Step 2 of 3",
      progressText: "Finish account linking, then Blueprint can load the servers you manage.",
      secondaryAction: {
        href: "/dashboard",
        label: "Open dashboard",
        type: "link",
        variant: "ghost",
      },
      stats: [],
      steps: [
        { label: "Continental ID session is active", status: "complete", statusLabel: "Done" },
        { label: "Link the Discord account you manage servers with", status: "current", statusLabel: "Now" },
        { label: "Install Blueprint in a server and continue setup", status: "pending", statusLabel: "Next" },
      ],
    };
  }

  if (guildCount === 0) {
    return {
      dashboardCopy:
        "Your Discord account is linked. Add Blueprint to a server you manage, then return here to configure modules.",
      dashboardEyebrow: "Install Blueprint",
      dashboardTitle: "Add Blueprint to a server you manage",
      headline: "Install Blueprint in your first server.",
      key: "no-servers",
      lede:
        "Account linking is done. The next step is adding Blueprint to a Discord server where you have setup rights so the dashboard can load a real server workspace.",
      primaryAction: {
        href: addBotUrl,
        label: "Add bot to a server",
        type: "link",
      },
      progressLabel: "Final setup step",
      progressText: "Install the bot in Discord, then return here to continue configuration.",
      secondaryAction: {
        href: "/dashboard",
        label: "Open dashboard",
        type: "link",
        variant: "ghost",
      },
      stats: [
        { label: "Discord link", value: "Ready" },
      ],
      steps: [
        { label: "Continental ID session is active", status: "complete", statusLabel: "Done" },
        { label: "Discord account is linked", status: "complete", statusLabel: "Done" },
        { label: "Install Blueprint in a server you manage", status: "current", statusLabel: "Now" },
      ],
    };
  }

  return {
    dashboardCopy:
      attentionServers > 0
        ? "Servers that still need attention are already sorted to the top so you can resume setup first."
        : "Every installed server is ready for routine edits, module changes, and expansion from one place.",
    dashboardEyebrow: "Installed servers",
    dashboardTitle:
      attentionServers > 0
        ? "Start with the servers that still need attention"
        : "Choose a server and keep configuring modules",
    headline:
      attentionServers > 0
        ? "Continue setup where your servers still need attention."
        : "Open Blueprint and manage your installed servers.",
    key: "servers-ready",
    lede:
      attentionServers > 0
        ? `${attentionServers} of your ${installedLabel} still have unfinished module setup. Blueprint surfaces those first so you can keep moving without hunting for the next task.`
        : `Your ${installedLabel} are ready in Blueprint. Open the dashboard to adjust modules, refine settings, or add more servers over time.`,
    primaryAction: {
      href: "/dashboard",
      label: "Open dashboard",
      type: "link",
    },
    progressLabel: attentionServers > 0 ? attentionLabel : "Ready to configure",
    progressText:
      attentionServers > 0
        ? "Resume the next unfinished module directly from the dashboard."
        : "Open any installed server and keep refining its module setup.",
    secondaryAction: {
      href: addBotUrl,
      label: "Add bot to another server",
      type: "link",
      variant: "ghost",
    },
    stats: [
      { label: "Installed", value: String(guildCount) },
      { label: "Need setup", value: String(attentionServers) },
      { label: "Ready", value: String(Math.max(guildCount - attentionServers, 0)) },
    ],
    steps: [
      { label: "Continental ID session is active", status: "complete", statusLabel: "Done" },
      { label: "Discord account is linked", status: "complete", statusLabel: "Done" },
      {
        label:
          attentionServers > 0
            ? "Continue the remaining module setup in your servers"
            : "Open a server dashboard and keep configuring modules",
        status: "current",
        statusLabel: attentionServers > 0 ? "Resume" : "Open",
      },
    ],
  };
}

function renderOnboardingSteps(onboardingState) {
  return onboardingState.steps
    .map((step) => `
      <li class="onboarding-step onboarding-step-${escapeHtml(step.status)}">
        <span class="onboarding-step-copy">${escapeHtml(step.label)}</span>
        <span class="onboarding-step-status">${escapeHtml(step.statusLabel)}</span>
      </li>
    `)
    .join("");
}

function renderOnboardingStats(onboardingState) {
  if (!onboardingState.stats || onboardingState.stats.length === 0) {
    return "";
  }

  return `
    <div class="onboarding-stats" aria-label="Setup status">
      ${onboardingState.stats
        .map((stat) => `
          <span class="dashboard-summary-pill">
            <strong>${escapeHtml(stat.value)}</strong>
            <span>${escapeHtml(stat.label)}</span>
          </span>
        `)
        .join("")}
    </div>
  `;
}

function renderHome({ addBotUrl, authConfig, guilds = [], sessionUser }) {
  const attentionServers = guilds.filter((guild) => guild.attentionCount > 0).length;
  const onboardingState = getDashboardOnboardingState({
    addBotUrl,
    attentionServers,
    discordLinked: Boolean(sessionUser?.discordLinked),
    guildCount: guilds.length,
    sessionUser,
  });

  const body = `
    <main class="hero home-page" id="main-content">
      <section class="hero-copy">
        <p class="eyebrow">Dashboard-first Discord control center</p>
        <h1>${escapeHtml(onboardingState.headline)}</h1>
        <p class="lede">${escapeHtml(onboardingState.lede)}</p>
        <div class="hero-actions">
          ${renderDashboardAction(onboardingState.primaryAction)}
          ${renderDashboardAction(onboardingState.secondaryAction)}
        </div>
        <section class="settings-card onboarding-panel onboarding-panel-home">
          <div class="onboarding-panel-copy">
            <p class="eyebrow">Next required step</p>
            <h2>${escapeHtml(onboardingState.progressLabel)}</h2>
            <p class="card-copy">${escapeHtml(onboardingState.progressText)}</p>
            ${renderOnboardingStats(onboardingState)}
          </div>
          <ol class="onboarding-checklist">
            ${renderOnboardingSteps(onboardingState)}
          </ol>
        </section>
        <div class="hero-metrics">
          <article class="hero-metric">
            <span class="hero-metric-label">Built for</span>
            <strong class="hero-metric-value">Modular server control</strong>
            <p class="hero-metric-copy">Turn modules on only where they belong and keep every server configurable.</p>
          </article>
          <article class="hero-metric">
            <span class="hero-metric-label">Primary workflow</span>
            <strong class="hero-metric-value">Dashboard first</strong>
            <p class="hero-metric-copy">Use slash commands for quick actions while major setup stays visual and centralized.</p>
          </article>
          <article class="hero-metric">
            <span class="hero-metric-label">Operator focus</span>
            <strong class="hero-metric-value">Fast setup triage</strong>
            <p class="hero-metric-copy">Spot unfinished modules quickly, jump into a server, and continue setup without guesswork.</p>
          </article>
        </div>
        <div class="hero-search-copy">
          <p>
            Blueprint is a Discord server management website for teams that want modular tools,
            cleaner setup, and a premium dashboard instead of command-heavy administration.
          </p>
        </div>
      </section>
      <section class="panel brand-panel">
        <div class="brand-panel-header">
          <img
            class="brand-panel-banner"
            src="/images/Blueprint-banner.png"
            alt="Blueprint"
          />
          <div class="brand-panel-signature">
            <img src="/images/C2-new-white.png" alt="" aria-hidden="true" />
            <span>Built by Continental</span>
          </div>
        </div>
        <p class="brand-panel-copy">
          Blueprint is Continental’s dashboard-first Discord control center: modular,
          polished, and designed to stay out of the way until you need it.
        </p>
        <div class="info-card-grid">
          <section class="info-card">
            <h2>What you can manage</h2>
            <ul class="feature-list">
              <li>Welcome flows and join roles</li>
              <li>Shared countdowns and daily alerts</li>
              <li>Audit feeds and moderation rules</li>
              <li>Announcements, suggestions, highlights, and screening</li>
            </ul>
          </section>
          <section class="info-card">
            <h2>How access works</h2>
            <ol class="feature-list feature-list-ordered">
              <li>Continue with Continental ID</li>
              <li>Use the Discord account linked to that identity</li>
              <li>Manage only the servers where Blueprint is installed and you have rights</li>
            </ol>
          </section>
        </div>
      </section>
      <section class="settings-card content-card home-section">
        <p class="eyebrow">Core capabilities</p>
        <h2>One control center, many installable Discord modules.</h2>
        <p>
          Blueprint is built for communities that need structured Discord bot management without
          forcing every change through slash commands. Modules can be enabled per server, configured
          independently, and left hidden when unused.
        </p>
        <div class="info-card-grid">
          <article class="info-card">
            <h3>Moderation and safety</h3>
            <p>Configure audit logs, anti-raid rules, join screening, automod, and staff workflows from the dashboard.</p>
          </article>
          <article class="info-card">
            <h3>Community operations</h3>
            <p>Manage welcome flows, tickets, reaction roles, suggestions, announcements, applications, and modmail.</p>
          </article>
          <article class="info-card">
            <h3>Server customization</h3>
            <p>Keep each guild separate with its own channels, roles, permissions, messages, and module states.</p>
          </article>
        </div>
      </section>
      <section class="settings-card content-card home-section">
        <p class="eyebrow">Why it ranks</p>
        <h2>A public website layer on top of an authenticated dashboard.</h2>
        <p>
          The public pages explain what Blueprint is, how it works, and how access is handled.
          Private dashboard pages stay excluded from search indexing, while the public pages carry
          the metadata, crawl files, and structured content needed for discoverability.
        </p>
      </section>
    </main>
  `;

  return renderLayout({
    authConfig,
    body,
    currentPath: "/",
    description:
      "Blueprint is a modular Discord bot control center with a dashboard-first workflow for moderation, automations, welcome flows, tickets, and server operations.",
    pageHeading: "Run Blueprint from one polished server dashboard.",
    schema: [buildSoftwareApplicationSchema()],
    sessionUser,
    title: "Discord Server Control Center",
  });
}

function renderDashboard({
  addBotUrl,
  authConfig,
  discordLinked,
  guilds,
  sessionUser,
}) {
  const sortedGuilds = [...guilds].sort((left, right) => {
    const leftNeedsSetup = left.attentionCount > 0 ? 1 : 0;
    const rightNeedsSetup = right.attentionCount > 0 ? 1 : 0;
    if (rightNeedsSetup !== leftNeedsSetup) {
      return rightNeedsSetup - leftNeedsSetup;
    }

    if (right.attentionCount !== left.attentionCount) {
      return right.attentionCount - left.attentionCount;
    }

    return left.name.localeCompare(right.name);
  });
  const attentionServers = sortedGuilds.filter((guild) => guild.attentionCount > 0).length;
  const readyServers = sortedGuilds.filter((guild) => guild.enabledCount > 0 && guild.attentionCount === 0).length;
  const onboardingState = getDashboardOnboardingState({
    addBotUrl,
    attentionServers,
    discordLinked,
    guildCount: sortedGuilds.length,
    sessionUser,
  });
  const cards = sortedGuilds
    .map((guild) => {
      const icon = guild.iconUrl
        ? `<img class="server-avatar-image" src="${escapeHtml(guild.iconUrl)}" alt="" />`
        : escapeHtml(guild.name.slice(0, 2).toUpperCase());
      const summaryHtml = renderModuleFacts([
        {
          label: "Enabled",
          valueHtml: String(guild.enabledCount),
        },
        {
          label: "Needs setup",
          valueHtml: String(guild.attentionCount),
        },
      ]);

      const href = `/dashboard/${guild.id}`;
      const actionLabel = guild.attentionCount > 0 ? "Continue setup" : "Open dashboard";
      const setupHeadline = guild.attentionCount > 0
        ? `${guild.attentionCount} module${guild.attentionCount === 1 ? "" : "s"} still need setup`
        : guild.enabledCount > 0
          ? "Configured and ready to use"
          : "No modules enabled yet";
      const setupCopy = guild.attentionCount > 0
        ? "Jump back in and finish the missing pieces first."
        : guild.enabledCount > 0
          ? "Review settings, refine modules, or add more features."
          : "Open this server and start enabling modules from the dashboard.";

      return `
        <a
          class="server-card ${guild.attentionCount > 0 ? "server-card-alert" : ""}"
          href="${href}"
          data-guild-card
          data-guild-attention="${guild.attentionCount > 0 ? "true" : "false"}"
          data-guild-name="${escapeHtml(guild.name.toLowerCase())}"
          aria-label="${escapeHtml(`${actionLabel} for ${guild.name}`)}"
        >
          <div class="server-card-meta-row">
            <span class="status-pill status-pill-${escapeHtml(guild.statusTone)}">
              ${escapeHtml(guild.statusLabel)}
            </span>
            <span class="server-card-timestamp">Updated ${escapeHtml(guild.updatedAtLabel)}</span>
          </div>
          <div class="server-card-head">
            <div class="server-avatar">${icon}</div>
            <div class="server-card-head-copy">
              <h2>${escapeHtml(guild.name)}</h2>
              <p>Installed and manageable by your linked Discord account</p>
            </div>
          </div>
          ${summaryHtml}
          <div class="server-card-progress">
            <strong>${escapeHtml(setupHeadline)}</strong>
            <p>${escapeHtml(setupCopy)}</p>
          </div>
          <div class="server-card-actions">
            <span class="server-card-action-label">${guild.attentionCount > 0 ? "Prioritized first" : "Ready when you are"}</span>
            <span class="server-card-action-text">${escapeHtml(actionLabel)}</span>
          </div>
        </a>
      `;
    })
    .join("");

  const showOnboardingPanel = !discordLinked || sortedGuilds.length === 0;
  const showServerControls = discordLinked && sortedGuilds.length > 0;

  const body = `
    <main class="dashboard-page" id="main-content">
      <section class="section-header">
        <div>
          <p class="eyebrow">${escapeHtml(onboardingState.dashboardEyebrow)}</p>
          <h1>${escapeHtml(onboardingState.dashboardTitle)}</h1>
          <p class="section-copy">${escapeHtml(onboardingState.dashboardCopy)}</p>
        </div>
        <div class="section-actions">
          ${renderDashboardAction(
            showServerControls ? onboardingState.secondaryAction : onboardingState.primaryAction,
          )}
        </div>
      </section>
      ${
        showOnboardingPanel
          ? `
            <section class="settings-card onboarding-panel onboarding-panel-dashboard">
              <div class="onboarding-panel-copy">
                <p class="eyebrow">Next required step</p>
                <h2>${escapeHtml(onboardingState.progressLabel)}</h2>
                <p class="card-copy">${escapeHtml(onboardingState.progressText)}</p>
                ${renderOnboardingStats(onboardingState)}
                <div class="onboarding-panel-actions">
                  ${renderDashboardAction(onboardingState.primaryAction)}
                  ${
                    onboardingState.secondaryAction && onboardingState.key !== "discord-unlinked"
                      ? renderDashboardAction(onboardingState.secondaryAction)
                      : ""
                  }
                </div>
              </div>
              <ol class="onboarding-checklist">
                ${renderOnboardingSteps(onboardingState)}
              </ol>
            </section>
          `
          : ""
      }
      <section class="settings-card dashboard-spotlight ${showServerControls ? "" : "is-hidden"}">
        <div class="dashboard-spotlight-copy">
          <p class="eyebrow">Setup overview</p>
          <h2>${escapeHtml(onboardingState.dashboardTitle)}</h2>
          <p class="card-copy">
            ${escapeHtml(onboardingState.dashboardCopy)}
          </p>
        </div>
        <div class="dashboard-spotlight-stats">
          <span class="dashboard-summary-pill">${sortedGuilds.length} installed</span>
          <span class="dashboard-summary-pill">${attentionServers} need setup</span>
          <span class="dashboard-summary-pill">${readyServers} ready</span>
        </div>
      </section>
      <section class="dashboard-toolbar ${showServerControls ? "" : "is-hidden"}">
        <label class="search-field">
          <span class="search-field-label">Search servers</span>
          <input
            type="search"
            placeholder="Search by server name"
            data-guild-search
          />
        </label>
        <div class="dashboard-toolbar-actions">
          <label class="checkbox-chip">
            <input type="checkbox" data-guild-attention-filter />
            <span>Show attention only</span>
          </label>
          <div class="dashboard-summary">
            <span class="dashboard-summary-pill">${sortedGuilds.length} servers</span>
            <span class="dashboard-summary-pill">${attentionServers} need setup</span>
          </div>
        </div>
      </section>
      ${
        showServerControls
          ? `
            <section class="server-grid">
              ${cards}
            </section>
            <div class="empty-state is-hidden" data-guild-search-empty>
              No servers match the current search and filter.
            </div>
          `
          : ""
      }
    </main>
  `;

  return renderLayout({
    authConfig,
    body,
    currentPath: "/dashboard",
    description: "Review installed servers, find modules that still need setup, and jump back into Blueprint quickly.",
    noindex: true,
    pageHeading: "Choose a server",
    sessionUser,
    title: "Server Dashboard",
  });
}

function renderGuildSettings({
  authConfig,
  channelOptions,
  errorMessage,
  guild,
  mentionRoleOptions,
  pageMeta,
  roleOptions,
  saveMessage,
  sessionUser,
  settings,
}) {
  const countdown = getCountdownResult(settings);
  const countdownAlert = getCountdownAlertSummary(settings, channelOptions);
  const moduleIndexHtml = renderModuleIndex(pageMeta?.modules || []);
  const firstBlockedModule = (pageMeta?.modules || []).find((module) => module.blocker);
  const firstBlockedModuleId = firstBlockedModule ? getModuleSectionId(firstBlockedModule.key) : "";
  const firstBlockedModuleLabel = firstBlockedModule?.label || "";
  const firstBlockedModuleBlocker = firstBlockedModule?.blocker || "";
  const selectedWeekdays = new Set(settings.countdownWeekdays || []);
  const hasSavedCountdown = Boolean(
    settings.countdownEnabled ||
    settings.countdownTitle ||
    settings.countdownTargetDate ||
    excludedDatesToTextarea(settings.countdownExcludedDates) ||
    settings.countdownAlertEnabled ||
    settings.countdownAlertChannelId ||
    settings.countdownAlertTimeZone !== DEFAULT_DAILY_ALERT_TIME_ZONE,
  );
  const countdownPreview = escapeHtml(countdown.commandPreview).replaceAll("\n", "<br />");
  const countdownAlertPreview = escapeHtml(countdownAlert.preview).replaceAll("\n", "<br />");
  const countdownAlertStatusClass = `status-pill status-pill-${countdownAlert.state}`;
  const excludedDateChips = countdown.excludedDates
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
  const countdownAlertTimeZoneOptions = renderCountdownAlertTimeZoneOptions(
    settings.countdownAlertTimeZone,
  );
  const countdownSummaryHtml = renderModuleFacts([
    {
      label: "Event",
      valueHtml: escapeHtml(countdown.title || "Not set"),
    },
    {
      label: "Target",
      valueHtml: escapeHtml(countdown.targetDateLabel || "Not set"),
    },
    {
      label: "Alerts",
      valueHtml: escapeHtml(getCountdownAlertStatusLabel(countdownAlert.state)),
    },
  ]);
  const weekdayCheckboxes = WEEKDAY_OPTIONS.map((weekday) => `
    <label class="weekday-pill">
      <input
        type="checkbox"
        name="countdownWeekdays"
        value="${weekday.value}"
        ${selectedWeekdays.has(weekday.value) ? "checked" : ""}
      />
      <span>${weekday.shortLabel}</span>
    </label>
  `).join("");
  const countdownChannelOptions = [
    `<option value="">Select a channel</option>`,
    ...channelOptions.map((channel) => `
      <option value="${escapeHtml(channel.id)}" ${
        settings.countdownAlertChannelId === channel.id ? "selected" : ""
      }>
        ${escapeHtml(channel.label)}
      </option>
    `),
  ].join("");
  const validationItems = (pageMeta?.modules || [])
    .filter((module) => module.blocker)
    .map(
      (module) => `
        <li>
          <a
            class="validation-link"
            href="#${getModuleSectionId(module.key)}"
            data-jump-module="${getModuleSectionId(module.key)}"
          >
            ${escapeHtml(module.label)}
          </a>
          <span>${escapeHtml(module.blocker)}</span>
        </li>
      `,
    )
    .join("");

  const body = `
    <main class="settings-page" id="main-content">
      <section class="section-header">
        <div>
          <p class="eyebrow">Server settings</p>
          <h1>${escapeHtml(guild.name)}</h1>
          <p class="section-copy">
            Jump between modules, resolve blockers quickly, and keep every change scoped to this
            server only.
          </p>
        </div>
        <div class="section-actions">
          <a class="button button-ghost" href="/dashboard">Back</a>
        </div>
      </section>

      <section class="overview-grid">
        <article class="overview-card">
          <span class="overview-label">Enabled modules</span>
          <strong class="overview-value" data-overview-enabled>${escapeHtml(String(pageMeta?.enabledModules || 0))}</strong>
          <p class="overview-copy">Every enabled dashboard module is counted here.</p>
        </article>
        <article class="overview-card ${pageMeta?.attentionModules ? "overview-card-alert" : ""}">
          <span class="overview-label">Needs setup</span>
          <strong class="overview-value" data-overview-attention>${escapeHtml(String(pageMeta?.attentionModules || 0))}</strong>
          <p class="overview-copy">Enabled modules with missing or invalid config.</p>
        </article>
        <article class="overview-card">
          <span class="overview-label">Hello command</span>
          <strong class="overview-value" data-overview-hello>${pageMeta?.helloEnabled ? "Live" : "Disabled"}</strong>
          <p class="overview-copy">Core reply access in this server.</p>
        </article>
        <article class="overview-card">
          <span class="overview-label">Last updated</span>
          <strong class="overview-value overview-value-small" data-overview-updated>${escapeHtml(pageMeta?.lastUpdatedLabel || "Not saved yet")}</strong>
          <p class="overview-copy">Most recent saved dashboard change.</p>
        </article>
      </section>

      <section
        class="settings-card setup-rail ${firstBlockedModuleId ? "has-issues" : "is-clear"}"
        data-setup-rail
      >
        <div class="setup-rail-head">
          <div class="setup-rail-copy">
            <p class="eyebrow">Setup flow</p>
            <h2 data-next-issue-label>
              ${
                firstBlockedModuleId
                  ? `Resolve ${escapeHtml(firstBlockedModuleLabel)} next`
                  : "All enabled modules are configured"
              }
            </h2>
            <p class="card-copy" data-next-issue-copy>
              ${
                firstBlockedModuleId
                  ? escapeHtml(firstBlockedModuleBlocker)
                  : "Use the module shortcuts below to review settings, make edits, and save when you are ready."
              }
            </p>
          </div>
          <div class="setup-rail-actions">
            <span class="dashboard-summary-pill" data-setup-issue-count>
              ${
                pageMeta?.attentionModules
                  ? `${escapeHtml(String(pageMeta.attentionModules))} issue${pageMeta.attentionModules === 1 ? "" : "s"}`
                  : "All configured"
              }
            </span>
            <button
              class="button ${firstBlockedModuleId ? "" : "is-hidden"}"
              type="button"
              data-review-issues
            >
              Review next issue
            </button>
          </div>
        </div>
        <div class="module-index-strip" aria-label="Module shortcuts">
          ${moduleIndexHtml}
        </div>
      </section>

      ${
        saveMessage
          ? `
            <div class="notice notice-success" tabindex="-1" role="status" data-flash-notice>
              <strong>Saved for ${escapeHtml(guild.name)}</strong>
              <p>${escapeHtml(saveMessage)}</p>
            </div>
          `
          : ""
      }
      ${
        errorMessage
          ? `
            <div class="notice notice-error" tabindex="-1" role="alert" data-flash-notice>
              <strong>Could not save changes</strong>
              <p>${escapeHtml(errorMessage)}</p>
            </div>
          `
          : ""
      }
      <section
        class="notice notice-warning ${validationItems ? "" : "is-hidden"}"
        data-validation-summary
        tabindex="-1"
        aria-live="polite"
      >
        <div class="notice-head">
          <div class="validation-summary-copy">
            <strong>Issue queue</strong>
            <p class="card-copy" data-validation-lead>
              ${
                firstBlockedModuleId
                  ? `Start with ${escapeHtml(firstBlockedModuleLabel)}: ${escapeHtml(firstBlockedModuleBlocker)}`
                  : "Every enabled module is configured."
              }
            </p>
          </div>
          ${
            firstBlockedModuleId
              ? `
                <div class="notice-actions">
                  <button class="button" type="button" data-review-issues>
                    Jump to first issue
                  </button>
                  <button class="button button-ghost" type="button" data-expand-issues>
                    Expand blocked modules
                  </button>
                </div>
              `
              : ""
          }
        </div>
        <ul class="validation-list" data-validation-list>
          ${validationItems}
        </ul>
      </section>

      <form class="settings-stack" method="post" action="/dashboard/${guild.id}" data-settings-form>
        <input type="hidden" name="_csrf" value="${escapeHtml(authConfig.csrfToken)}" />
        <section class="settings-card" data-settings-scope="core">
          <div class="card-header">
            <div>
              <p class="eyebrow">Core commands</p>
              <h2>Reply settings</h2>
              <p class="card-copy">
                Adjust the built-in slash commands and keep the dashboard-owned replies consistent.
              </p>
            </div>
          </div>

          ${renderFeatureToggle({
            checked: settings.helloEnabled,
            descriptionHtml:
              "Make <code>/hello</code> available in this server, or turn it off completely when you do not want the command exposed.",
            disabledLabel: "Command off",
            enabledLabel: "Command on",
            inputName: "helloEnabled",
            kindLabel: "Command status",
            titleHtml: "<code>/hello</code> access",
          })}

          <div class="field-grid">
            <label>
              <span>Ping response</span>
              <input
                name="pingResponse"
                maxlength="120"
                value="${escapeHtml(settings.pingResponse)}"
                required
              />
            </label>

            <label>
              <span>Hello template</span>
              <input
                name="helloTemplate"
                maxlength="160"
                value="${escapeHtml(settings.helloTemplate)}"
                required
              />
              <small>Use <code>{user}</code> and <code>{server}</code>.</small>
            </label>

            <label>
              <span>Accent color</span>
              <input
                type="color"
                name="accentColor"
                value="${escapeHtml(settings.accentColor)}"
              />
            </label>
          </div>
        </section>

        ${renderModuleCard({
          bodyHtml: `
            <div class="countdown-layout">
              <div class="countdown-fields">
                <div class="subsection subsection-card">
                  <div class="card-header">
                    <div>
                      <span class="subsection-label">Countdown basics</span>
                      <p class="card-copy">
                        Set the event name, target date, and how Blueprint should count down to it.
                      </p>
                    </div>
                  </div>
                  <div class="field-grid">
                    <label>
                      <span>Event name</span>
                      <input
                        name="countdownTitle"
                        maxlength="80"
                        placeholder="Summer break, launch day, finals week..."
                        value="${escapeHtml(settings.countdownTitle)}"
                      />
                    </label>

                    <label>
                      <span>Target date</span>
                      <input
                        type="date"
                        name="countdownTargetDate"
                        value="${escapeHtml(settings.countdownTargetDate)}"
                      />
                    </label>

                    <label>
                      <span>Counting mode</span>
                      <select name="countdownMode" data-countdown-mode>
                        <option value="calendar" ${settings.countdownMode === "calendar" ? "selected" : ""}>
                          Calendar days
                        </option>
                        <option value="active-days" ${settings.countdownMode === "active-days" ? "selected" : ""}>
                          Selected weekdays only
                        </option>
                      </select>
                      <small data-countdown-mode-copy>
                        ${escapeHtml(getCountdownModeCopy(settings.countdownMode))}
                      </small>
                    </label>
                  </div>
                </div>

                <details
                  class="config-disclosure"
                  data-countdown-schedule-panel
                  ${settings.countdownMode === "active-days" || countdown.excludedDates.length ? "open" : ""}
                >
                  <summary>Scheduling rules and excluded dates</summary>
                  <div class="config-disclosure-body">
                    <p class="config-disclosure-copy">
                      Use this when the countdown should only include selected weekdays or skip holidays and other off-days.
                    </p>
                    <div
                      class="countdown-schedule-fields ${settings.countdownMode === "active-days" ? "" : "is-hidden"}"
                      data-countdown-schedule-fields
                    >
                      <div class="subsection">
                        <span class="subsection-label">Count these weekdays</span>
                        <div class="weekday-grid">
                          ${weekdayCheckboxes}
                        </div>
                      </div>

                      <div class="subsection">
                        <div class="card-header">
                          <div>
                            <span class="subsection-label">Excluded dates</span>
                            <p class="card-copy">
                              Remove holidays, breaks, and other off-days from selected weekday countdowns.
                            </p>
                          </div>
                        </div>

                        <div class="excluded-dates-panel">
                          <input
                            type="hidden"
                            name="countdownExcludedDates"
                            value="${escapeHtml(countdown.excludedDates.join(","))}"
                            data-excluded-dates-hidden
                          />

                          <div class="excluded-dates-input-row">
                            <label class="excluded-date-picker">
                              <span>Add excluded date</span>
                              <input type="date" data-excluded-date-input />
                            </label>
                            <button
                              class="button button-ghost button-small"
                              type="button"
                              data-excluded-date-add
                            >
                              Add date
                            </button>
                          </div>

                          <div
                            class="excluded-date-chip-list ${excludedDateChips ? "" : "is-hidden"}"
                            data-excluded-date-list
                          >
                            ${excludedDateChips}
                          </div>

                          <p
                            class="preview-note ${excludedDateChips ? "is-hidden" : ""}"
                            data-excluded-date-empty
                          >
                            No excluded dates selected yet.
                          </p>

                          <small>
                            Excluded dates only reduce the countdown when they fall on a selected weekday
                            after today and before the target date.
                          </small>
                        </div>
                      </div>
                    </div>
                  </div>
                </details>

                <details
                  class="config-disclosure"
                  data-countdown-alert-panel
                  ${
                    settings.countdownAlertEnabled ||
                    settings.countdownAlertChannelId ||
                    settings.countdownAlertTimeZone !== DEFAULT_DAILY_ALERT_TIME_ZONE
                      ? "open"
                      : ""
                  }
                >
                  <summary>Daily alert delivery</summary>
                  <div class="config-disclosure-body">
                    <div class="card-header card-header-spread subsection-header">
                      <div>
                        <span class="subsection-label">Daily alerts</span>
                        <p class="card-copy">
                          Post one countdown update per day in a chosen channel at a local server time.
                        </p>
                      </div>
                      <div class="${countdownAlertStatusClass}" data-countdown-alert-status>
                        ${escapeHtml(getCountdownAlertStatusLabel(countdownAlert.state))}
                      </div>
                    </div>

                    ${renderFeatureToggle({
                      checked: settings.countdownAlertEnabled,
                      descriptionHtml:
                        "Enable one daily countdown post for this server. Blueprint sends it once per day after the chosen time until the target date arrives.",
                      disabledLabel: "Alerts off",
                      enabledLabel: "Alerts on",
                      inputName: "countdownAlertEnabled",
                      kindLabel: "Delivery",
                      titleHtml: "Daily countdown alerts",
                    })}

                    <div
                      class="field-grid countdown-alert-fields ${settings.countdownAlertEnabled ? "" : "is-hidden"}"
                      data-countdown-alert-fields
                    >
                      <label>
                        <span>Alert channel</span>
                        <select name="countdownAlertChannelId">
                          ${countdownChannelOptions}
                        </select>
                      </label>

                      <label>
                        <span>Alert time zone</span>
                        <select name="countdownAlertTimeZone">
                          ${countdownAlertTimeZoneOptions}
                        </select>
                        <small>Schedule alerts in the server's local time zone.</small>
                      </label>

                      <label>
                        <span>Send time</span>
                        <input
                          type="time"
                          name="countdownAlertTime"
                          value="${escapeHtml(settings.countdownAlertTime)}"
                        />
                        <small data-countdown-alert-time-copy>${escapeHtml(countdownAlert.timeHelpText)}</small>
                      </label>
                    </div>
                  </div>
                </details>

                <div class="subsection danger-zone">
                  <div class="card-header">
                    <div>
                      <span class="subsection-label">Remove countdown</span>
                      <p class="card-copy">
                        Clear the shared countdown, excluded dates, and daily alert settings for this server.
                      </p>
                    </div>
                  </div>
                  <div class="danger-zone-actions">
                    <button
                      class="button button-danger"
                      type="submit"
                      formaction="/dashboard/${guild.id}/countdown/remove"
                      formmethod="post"
                      formnovalidate
                      onclick="return window.confirm('Remove this server\\'s countdown and clear its alert settings?');"
                      ${hasSavedCountdown ? "" : "disabled"}
                    >
                      Remove countdown
                    </button>
                    <p class="preview-note">
                      ${hasSavedCountdown
                        ? "This clears the countdown module without touching welcome, auto-role, or core reply settings."
                        : "There is no saved countdown configuration to remove right now."}
                    </p>
                  </div>
                </div>
              </div>

              <aside class="preview-card">
                <span class="preview-label">Countdown preview</span>
                <div class="countdown-preview" data-countdown-preview>${countdownPreview}</div>
                <div class="preview-meta">
                  <div>
                    <span>Mode</span>
                    <strong data-countdown-mode-label>${escapeHtml(countdown.modeLabel)}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong data-countdown-status-label>${escapeHtml(getCountdownStatusLabel(countdown.state))}</strong>
                  </div>
                  <div>
                    <span>Target</span>
                    <strong data-countdown-target-label>${escapeHtml(countdown.targetDateLabel || "Not set")}</strong>
                  </div>
                </div>
                <p class="preview-note" data-countdown-meta-line>${escapeHtml(countdown.metaLine)}</p>
                <p
                  class="preview-note ${countdown.scheduleLine ? "" : "is-hidden"}"
                  data-countdown-schedule-line
                >
                  ${escapeHtml(countdown.scheduleLine || "")}
                </p>
                <p
                  class="preview-note ${countdown.breakdownLine ? "" : "is-hidden"}"
                  data-countdown-breakdown-line
                >
                  ${escapeHtml(countdown.breakdownLine || "")}
                </p>
                <p
                  class="preview-note ${countdown.ignoredExclusionsLine ? "" : "is-hidden"}"
                  data-countdown-ignored-line
                >
                  ${escapeHtml(countdown.ignoredExclusionsLine || "")}
                </p>

                <span class="preview-label">Daily alert preview</span>
                <div class="countdown-preview" data-countdown-alert-preview>${countdownAlertPreview}</div>
                <div class="preview-meta preview-meta-dual">
                  <div>
                    <span>Channel</span>
                    <strong data-countdown-alert-channel-label>${escapeHtml(countdownAlert.channelLabel)}</strong>
                  </div>
                  <div>
                    <span>Time</span>
                    <strong data-countdown-alert-time-label>${escapeHtml(countdownAlert.timeLabel)}</strong>
                  </div>
                </div>
                <p class="preview-note" data-countdown-alert-note>${escapeHtml(countdownAlert.note)}</p>
              </aside>
            </div>
          `,
          checked: settings.countdownEnabled,
          blockerHtml: escapeHtml(pageMeta?.moduleBlockers?.countdown || ""),
          defaultOpen: Boolean(pageMeta?.moduleBlockers?.countdown),
          descriptionHtml:
            "Configure one shared countdown that anyone in the server can check with <code>/countdown</code>.",
          eyebrow: "Countdown",
          inputName: "countdownEnabled",
          moduleKey: "countdown",
          moduleId: "countdown",
          statusHtml: `
            <div
              class="status-pill status-pill-${getCountdownStatusTone(countdown.state)}"
              data-status-target="countdown"
            >
              ${escapeHtml(getCountdownStatusLabel(countdown.state))}
            </div>
          `,
          summaryHtml: countdownSummaryHtml,
          theme: "countdown",
          titleHtml: "Server-wide event countdown",
        })}

        ${renderWelcomeModuleCard({
          blockerText: pageMeta?.moduleBlockers?.welcome || "",
          channelOptions,
          defaultOpen: Boolean(pageMeta?.moduleBlockers?.welcome),
          guildName: guild.name,
          settings,
        })}

        ${renderAutoRoleModuleCard({
          blockerText: pageMeta?.moduleBlockers?.autoRole || "",
          defaultOpen: Boolean(pageMeta?.moduleBlockers?.autoRole),
          roleOptions,
          settings,
        })}

        ${renderAuditLogModuleCard({
          blockerText: pageMeta?.moduleBlockers?.auditLog || "",
          channelOptions,
          defaultOpen: Boolean(pageMeta?.moduleBlockers?.auditLog),
          settings,
        })}

        ${renderAutoModerationModuleCard({
          blockerText: pageMeta?.moduleBlockers?.autoModeration || "",
          channelOptions,
          defaultOpen: Boolean(pageMeta?.moduleBlockers?.autoModeration),
          settings,
        })}

        ${renderJoinScreeningModuleCard({
          blockerText: pageMeta?.moduleBlockers?.joinScreening || "",
          channelOptions,
          defaultOpen: Boolean(pageMeta?.moduleBlockers?.joinScreening),
          roleOptions,
          settings,
        })}

        ${renderAnnouncementModuleCard({
          blockerText: pageMeta?.moduleBlockers?.announcements || "",
          channelOptions,
          defaultOpen: Boolean(pageMeta?.moduleBlockers?.announcements),
          mentionRoleOptions,
          settings,
        })}

        ${renderStarboardModuleCard({
          blockerText: pageMeta?.moduleBlockers?.starboard || "",
          channelOptions,
          defaultOpen: Boolean(pageMeta?.moduleBlockers?.starboard),
          settings,
        })}

        ${renderSuggestionModuleCard({
          blockerText: pageMeta?.moduleBlockers?.suggestions || "",
          channelOptions,
          defaultOpen: Boolean(pageMeta?.moduleBlockers?.suggestions),
          settings,
        })}

        ${renderReactionRoleModuleCard({
          blockerText: pageMeta?.moduleBlockers?.reactionRoles || "",
          channelOptions,
          defaultOpen: Boolean(pageMeta?.moduleBlockers?.reactionRoles),
          roleOptions,
          settings,
        })}
        ${renderTicketModuleCard({
          blockerText: pageMeta?.moduleBlockers?.tickets || "",
          channelOptions,
          defaultOpen: Boolean(pageMeta?.moduleBlockers?.tickets),
          mentionRoleOptions,
          settings,
        })}

        ${renderLevelingModuleCard({
          blockerText: pageMeta?.moduleBlockers?.leveling || "",
          channelOptions,
          defaultOpen: Boolean(pageMeta?.moduleBlockers?.leveling),
          settings,
        })}

        ${renderAntiRaidModuleCard({
          blockerText: pageMeta?.moduleBlockers?.antiRaid || "",
          channelOptions,
          defaultOpen: Boolean(pageMeta?.moduleBlockers?.antiRaid),
          settings,
        })}

        ${renderAutomationModuleCard({
          blockerText: pageMeta?.moduleBlockers?.automations || "",
          channelOptions,
          defaultOpen: Boolean(pageMeta?.moduleBlockers?.automations),
          settings,
        })}

        ${renderModmailModuleCard({
          blockerText: pageMeta?.moduleBlockers?.modmail || "",
          channelOptions,
          defaultOpen: Boolean(pageMeta?.moduleBlockers?.modmail),
          roleOptions: mentionRoleOptions,
          settings,
        })}

        ${renderApplicationsModuleCard({
          blockerText: pageMeta?.moduleBlockers?.applications || "",
          channelOptions,
          defaultOpen: Boolean(pageMeta?.moduleBlockers?.applications),
          roleOptions: mentionRoleOptions,
          settings,
        })}

        ${renderAiToolsModuleCard({
          blockerText: pageMeta?.moduleBlockers?.aiTools || "",
          channelOptions,
          defaultOpen: Boolean(pageMeta?.moduleBlockers?.aiTools),
          settings,
        })}
        <section class="save-bar" data-save-bar>
          <div class="save-bar-copy">
            <strong class="save-bar-title" data-save-title>All changes saved</strong>
            <p class="save-bar-note" data-save-status>
              Changes only apply to ${escapeHtml(guild.name)} after you save them.
            </p>
          </div>
          <div class="save-bar-actions">
            <button
              class="button button-ghost ${firstBlockedModuleId ? "" : "is-hidden"}"
              type="button"
              data-review-issues
            >
              Review issues
            </button>
            <button class="button button-ghost" type="reset" data-discard-button>Discard</button>
            <button class="button" type="submit" data-save-button>Save settings</button>
          </div>
        </section>
      </form>
    </main>
  `;

  return renderLayout({
    authConfig,
    body,
    currentPath: `/dashboard/${guild.id}`,
    description: `Configure modules, automation, moderation, and server workflows for ${guild.name} in Blueprint.`,
    noindex: true,
    pageHeading: guild.name,
    sessionUser,
    title: `${guild.name} Settings`,
  });
}

function renderAuthComplete({ authConfig, returnTo, sessionUser }) {
  const body = `
    <main class="center-page">
      <section class="center-panel">
        <p class="eyebrow">Continental ID</p>
        <h1>Finishing sign-in</h1>
        <p class="lede">
          This page refreshes your Dashboard session, reuses any active Continental ID session it
          finds, syncs it into Blueprint, and returns you to the control center.
        </p>
        <div class="hero-actions">
          <button class="button" id="relogin-button" type="button">Continue with Continental ID</button>
        </div>
        <p class="helper-text" data-auth-complete="true" data-return-to="${escapeHtml(returnTo)}">
          Waiting for an active Continental ID session. If this device is already signed in, Blueprint will reuse it.
        </p>
      </section>
    </main>
  `;

  return renderLayout({
    authConfig,
    body,
    currentPath: "/auth/complete",
    description: "Complete Blueprint sign-in and return to the control center.",
    noindex: true,
    pageHeading: "Finishing sign-in",
    sessionUser,
    title: "Complete Sign-In",
  });
}

function renderLegalPage({
  authConfig,
  currentPath,
  description,
  sections,
  sessionUser,
  title,
}) {
  const body = `
    <main class="content-page" id="main-content">
      <section class="settings-card content-hero">
        <div>
          <p class="eyebrow">Website information</p>
          <h1>${escapeHtml(title)}</h1>
          <p class="section-copy">${escapeHtml(description)}</p>
        </div>
      </section>
      <section class="content-stack">
        ${sections
          .map(
            (section) => `
              <article class="settings-card content-card">
                <h2>${escapeHtml(section.title)}</h2>
                ${section.paragraphs
                  .map((paragraph) => `<p>${paragraph}</p>`)
                  .join("")}
              </article>
            `,
          )
          .join("")}
      </section>
    </main>
  `;

  return renderLayout({
    authConfig,
    body,
    currentPath,
    description,
    pageHeading: title,
    schema: [buildBreadcrumbSchema(currentPath, title)],
    sessionUser,
    title,
  });
}

function renderPrivacyPage({ authConfig, sessionUser }) {
  return renderLegalPage({
    authConfig,
    currentPath: "/privacy",
    description:
      "How Blueprint handles authentication, server configuration data, and basic website usage data.",
    sections: [
      {
        title: "What Blueprint stores",
        paragraphs: [
          "Blueprint stores the minimum service data needed to operate the website and Discord bot. That includes your authenticated website session, your linked Discord account identifier when provided by the Continental ID system, and per-server configuration saved through the dashboard.",
          "Server settings can include channel IDs, role IDs, module toggles, message templates, and other configuration values required to run enabled modules.",
        ],
      },
      {
        title: "How data is used",
        paragraphs: [
          "This data is used to sign you in, determine which Discord servers you are allowed to manage, and apply the settings you save for each server.",
          "Blueprint does not need broad personal-profile data to perform its core workflow. It uses only the fields required to match authenticated users to Discord access and persist server configuration.",
        ],
      },
      {
        title: "Cookies and sessions",
        paragraphs: [
          "Blueprint uses a session cookie so the dashboard can keep you signed in between requests. The cookie is used for authentication and basic session integrity, not for advertising.",
        ],
      },
      {
        title: "Sharing and retention",
        paragraphs: [
          "Blueprint configuration data is used internally to operate the service and is not intended for resale or marketing use. Data may be retained as long as it is needed to provide the bot, maintain configuration history, or satisfy operational and security needs.",
        ],
      },
      {
        title: "Your responsibilities",
        paragraphs: [
          "Only save data to Blueprint that is appropriate for your server configuration workflows. Avoid placing sensitive secrets or private personal information into free-text settings unless the feature explicitly requires it and your organization approves that usage.",
        ],
      },
    ],
    sessionUser,
    title: "Privacy Policy",
  });
}

function renderTermsPage({ authConfig, sessionUser }) {
  return renderLegalPage({
    authConfig,
    currentPath: "/terms",
    description:
      "The operating terms for using the Blueprint website, dashboard, and connected Discord bot.",
    sections: [
      {
        title: "Service scope",
        paragraphs: [
          "Blueprint provides a dashboard-first control center for managing modular Discord bot features on a per-server basis. Access to some functionality depends on a valid sign-in session and the permissions of your linked Discord account.",
        ],
      },
      {
        title: "Acceptable use",
        paragraphs: [
          "You may use Blueprint only for legitimate server-management purposes and only in servers where you are authorized to make configuration changes. You must not attempt to bypass permissions, abuse automation features, interfere with service availability, or use Blueprint in ways that violate Discord rules or applicable law.",
        ],
      },
      {
        title: "Configuration responsibility",
        paragraphs: [
          "Server administrators are responsible for the settings they enable, the roles and channels they target, and the messages or automations they configure. Because Blueprint is modular, features should be reviewed before enabling them in live communities.",
        ],
      },
      {
        title: "Availability and changes",
        paragraphs: [
          "Blueprint may change, improve, limit, or remove features over time. Availability is not guaranteed, and some parts of the service may depend on third-party systems such as Discord or the external authentication provider.",
        ],
      },
      {
        title: "No warranty",
        paragraphs: [
          "Blueprint is provided on an as-available basis. Operators should test changes before relying on them in production communities, especially for moderation, automation, and role-management modules.",
        ],
      },
    ],
    sessionUser,
    title: "Terms of Service",
  });
}

function renderNotFoundPage({ authConfig, sessionUser }) {
  const body = `
    <main class="center-page" id="main-content">
      <section class="center-panel">
        <p class="eyebrow">404</p>
        <h1>Page not found</h1>
        <p class="lede">
          The page you requested does not exist on this Blueprint deployment.
        </p>
        <div class="hero-actions">
          <a class="button" href="/">Back home</a>
          <a class="button button-ghost" href="/dashboard">Open dashboard</a>
        </div>
      </section>
    </main>
  `;

  return renderLayout({
    authConfig,
    body,
    currentPath: "/404",
    description: "The requested Blueprint page could not be found.",
    noindex: true,
    pageHeading: "Page not found",
    sessionUser,
    title: "Page Not Found",
  });
}

module.exports = {
  renderAuthComplete,
  renderDashboard,
  renderGuildSettings,
  renderHome,
  renderNotFoundPage,
  renderPrivacyPage,
  renderTermsPage,
};

function buildCanonicalUrl(pathname) {
  const trimmedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${config.baseUrl}${trimmedPath}`;
}

function renderStructuredData(entries) {
  const filtered = entries.filter(Boolean);
  if (!filtered.length) {
    return "";
  }

  return filtered
    .map(
      (entry) =>
        `<script type="application/ld+json">${JSON.stringify(entry)}</script>`,
    )
    .join("\n    ");
}

function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    logo: buildCanonicalUrl("/images/blueprint-pfp2.png"),
    name: "Blueprint",
    url: config.baseUrl,
  };
}

function buildWebPageSchema({ currentPath, description, pageHeading, title }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    description,
    headline: pageHeading || title,
    name: title,
    url: buildCanonicalUrl(currentPath),
  };
}

function buildSoftwareApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    applicationCategory: "BusinessApplication",
    description:
      "Blueprint is a modular, dashboard-first Discord bot control center for moderation, community operations, and server configuration.",
    image: buildCanonicalUrl("/images/Blueprint-banner.png"),
    name: "Blueprint",
    operatingSystem: "Web",
    provider: {
      "@type": "Organization",
      name: "Continental",
    },
    url: config.baseUrl,
  };
}

function buildBreadcrumbSchema(currentPath, title) {
  const path = currentPath === "/" ? [] : currentPath.split("/").filter(Boolean);
  const items = [
    {
      "@type": "ListItem",
      item: config.baseUrl,
      name: "Home",
      position: 1,
    },
  ];

  if (path.length > 0) {
    items.push({
      "@type": "ListItem",
      item: buildCanonicalUrl(currentPath),
      name: title,
      position: 2,
    });
  }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

const MODULE_SECTION_IDS = {
  announcements: "module-announcements",
  auditLog: "module-audit-log",
  autoModeration: "module-auto-moderation",
  autoRole: "module-auto-role",
  countdown: "module-countdown",
  joinScreening: "module-join-screening",
  leveling: "module-leveling",
  starboard: "module-starboard",
  suggestions: "module-suggestions",
  tickets: "module-tickets",
  welcome: "module-welcome",
};

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

function getCountdownStatusTone(state) {
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

function getCountdownModeCopy(mode) {
  if (mode === "active-days") {
    return "Count only selected weekdays after today and before the target date. Excluded dates only reduce the countdown when they fall on one of those counted days.";
  }

  return "Count every calendar day from today to the target date.";
}

function renderCountdownAlertTimeZoneOptions(selectedTimeZone) {
  const safeSelectedTimeZone = String(selectedTimeZone || DEFAULT_DAILY_ALERT_TIME_ZONE);
  const commonTimeZones = Array.from(
    new Set([safeSelectedTimeZone, ...COMMON_DAILY_ALERT_TIME_ZONES]),
  ).filter((timeZone) => SUPPORTED_DAILY_ALERT_TIME_ZONES.includes(timeZone));
  const commonTimeZoneSet = new Set(commonTimeZones);
  const allOtherTimeZones = SUPPORTED_DAILY_ALERT_TIME_ZONES.filter(
    (timeZone) => !commonTimeZoneSet.has(timeZone),
  );

  return [
    `<optgroup label="Common time zones">${commonTimeZones
      .map((timeZone) => renderCountdownAlertTimeZoneOption(timeZone, safeSelectedTimeZone))
      .join("")}</optgroup>`,
    `<optgroup label="All time zones">${allOtherTimeZones
      .map((timeZone) => renderCountdownAlertTimeZoneOption(timeZone, safeSelectedTimeZone))
      .join("")}</optgroup>`,
  ].join("");
}

function renderCountdownAlertTimeZoneOption(timeZone, selectedTimeZone) {
  return `
    <option value="${escapeHtml(timeZone)}" ${timeZone === selectedTimeZone ? "selected" : ""}>
      ${escapeHtml(timeZone)}
    </option>
  `;
}

function formatExcludedDateChipLabel(isoDate) {
  return formatDateLabel(isoDate) || isoDate;
}

function renderModuleIndex(modules = []) {
  return modules
    .map((module) => `
      <a
        class="module-index-item module-index-item-${escapeHtml(module.state)} ${module.blocker ? "is-alert" : ""}"
        href="#${getModuleSectionId(module.key)}"
        data-module-blocker="${escapeHtml(module.blocker || "")}"
        data-module-enabled="${module.enabled ? "true" : "false"}"
        data-jump-module="${getModuleSectionId(module.key)}"
        data-module-nav-label="${escapeHtml(module.label)}"
        data-module-nav="${escapeHtml(module.key)}"
        data-module-state="${escapeHtml(module.state)}"
        aria-label="${escapeHtml(`${module.label}: ${getModuleDisplayStateLabel(module.state)}. ${getModuleNavigationSummary(module)}`)}"
        title="${escapeHtml(getModuleNavigationSummary(module))}"
      >
        <span class="module-index-top">
          <span class="module-index-name" data-module-nav-name="${escapeHtml(module.key)}">${escapeHtml(module.label)}</span>
          <span
            class="status-pill status-pill-${escapeHtml(module.state)}"
            data-module-nav-pill="${escapeHtml(module.key)}"
          >
            ${escapeHtml(getModuleDisplayStateLabel(module.state))}
          </span>
        </span>
        <span class="module-index-meta" data-module-nav-meta="${escapeHtml(module.key)}">
          ${escapeHtml(getModuleNavigationMeta(module))}
        </span>
      </a>
    `)
    .join("");
}

function getModuleSectionId(moduleKey) {
  return MODULE_SECTION_IDS[moduleKey] || `module-${toKebabCase(moduleKey)}`;
}

function getModuleDisplayStateLabel(state) {
  if (state === "live") {
    return "Live";
  }

  if (state === "today") {
    return "Today";
  }

  if (state === "ended") {
    return "Ended";
  }

  if (state === "incomplete") {
    return "Needs setup";
  }

  return "Disabled";
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

function toKebabCase(value) {
  return String(value || "")
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replaceAll(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase();
}
