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
  const authButton = currentPath === "/"
    ? `<a class="button button-control-link" href="/dashboard">Open Control Center</a>`
    : sessionUser
    ? `<form class="inline-form" method="post" action="/logout">
        <input type="hidden" name="_csrf" value="${escapeHtml(authConfig.csrfToken || "")}" />
        <button class="button button-ghost" type="submit">Log out</button>
      </form>`
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

  const topbarNav = currentPath === "/"
    ? `
    <nav class="topbar-nav topbar-nav-landing" aria-label="Primary">
      <a href="#capabilities">Capabilities</a>
      <a href="#modules">Modules</a>
      <a href="#workflow">How it works</a>
    </nav>
  `
    : `
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
  const body = `
    <main class="landing-page" id="main-content">
      <section class="landing-hero" aria-labelledby="landing-title">
        <div class="landing-hero-copy">
          <div class="landing-eyebrow"><span class="landing-pulse" aria-hidden="true"></span> Dashboard-first Discord control</div>
          <h1 id="landing-title">Your server has its own <em>blueprint.</em></h1>
          <p class="landing-lede">Blueprint brings the systems that keep a community moving into one considered control center. Enable what fits, configure it your way, and leave the rest out of sight.</p>
          <div class="landing-actions">
            <a class="button landing-primary-action" href="/dashboard">Open Control Center <span aria-hidden="true">→</span></a>
            <a class="landing-text-link" href="#capabilities">See what it can do <span aria-hidden="true">↓</span></a>
          </div>
          <div class="landing-trust-row" aria-label="Blueprint principles">
            <span>Modular by design</span><span>Built for real teams</span><span>One server at a time</span>
          </div>
        </div>
        <div class="landing-console" aria-label="Blueprint Control Center preview">
          <div class="console-orbit console-orbit-one" aria-hidden="true"></div>
          <div class="console-orbit console-orbit-two" aria-hidden="true"></div>
          <div class="console-window">
            <div class="console-sidebar">
              <div class="console-brand-mark"><img src="/images/blueprint-pfp2.png" alt="" /></div>
              <span class="console-sidebar-dot is-active"></span><span class="console-sidebar-dot"></span><span class="console-sidebar-dot"></span>
            </div>
            <div class="console-main">
              <div class="console-topline"><div><span class="console-kicker">Control center</span><strong>Northstar Community</strong></div><span class="console-avatar">NC</span></div>
              <div class="console-overview"><div><span>Server overview</span><strong>Everything in order.</strong></div><span class="console-ready"><i></i> Ready</span></div>
              <div class="console-cards">
                <article class="console-module"><span class="console-module-icon icon-shield">⌁</span><div><strong>Moderation</strong><small>Safeguards are active</small></div><b>On</b></article>
                <article class="console-module"><span class="console-module-icon icon-spark">✦</span><div><strong>Welcome</strong><small>A warm first hello</small></div><b>On</b></article>
                <article class="console-module"><span class="console-module-icon icon-ticket">□</span><div><strong>Tickets</strong><small>Ready when needed</small></div><b>On</b></article>
              </div>
              <div class="console-activity"><span class="console-activity-line"></span><span>Reviewing the details, without losing the bigger picture.</span></div>
            </div>
          </div>
        </div>
      </section>

      <section class="landing-intro" id="capabilities" aria-labelledby="capabilities-title">
        <div><p class="landing-section-kicker">A calmer way to run Discord</p><h2 id="capabilities-title">The work behind a great community should feel this clear.</h2></div>
        <p>Blueprint keeps complex server systems organized into focused modules—so your team can see what is running, understand why, and adjust it without digging through commands.</p>
      </section>

      <section class="landing-capability-grid" aria-label="Blueprint capabilities">
        <article class="landing-capability-card capability-safety"><span class="capability-number">01</span><div class="capability-symbol">⌁</div><h3>Keep the room steady.</h3><p>Moderation, anti-raid protection, audit logs, and join screening give your team a composed place to respond.</p><span class="capability-foot">Safety &amp; oversight</span></article>
        <article class="landing-capability-card capability-community"><span class="capability-number">02</span><div class="capability-symbol">✦</div><h3>Make people feel expected.</h3><p>Welcome flows, reaction roles, announcements, applications, and suggestions help a server feel designed for its members.</p><span class="capability-foot">Community systems</span></article>
        <article class="landing-capability-card capability-operations"><span class="capability-number">03</span><div class="capability-symbol">↗</div><h3>Give operations a home.</h3><p>Tickets, modmail, automations, leveling, and AI tools stay close at hand without crowding the parts you do not use.</p><span class="capability-foot">Staff workflows</span></article>
      </section>

      <section class="landing-workflow" id="workflow" aria-labelledby="workflow-title">
        <div class="landing-workflow-copy"><p class="landing-section-kicker">A control center, not a command maze</p><h2 id="workflow-title">Built around the way teams actually work.</h2><p>Use Discord for the moments that need a fast response. Use Blueprint when the job is to shape a system thoughtfully. Each server has its own settings, permissions, messages, channels, and modules.</p><a class="landing-inline-action" href="/dashboard">Take me to the Control Center <span aria-hidden="true">→</span></a></div>
        <ol class="landing-steps"><li><span>01</span><div><strong>Choose your building blocks</strong><p>Enable only the modules your community needs.</p></div></li><li><span>02</span><div><strong>Make them yours</strong><p>Set roles, channels, copy, and permissions per server.</p></div></li><li><span>03</span><div><strong>Keep a clear view</strong><p>Return to one dashboard as your community evolves.</p></div></li></ol>
      </section>

      <section class="landing-modules" id="modules" aria-labelledby="modules-title">
        <div class="landing-module-heading"><p class="landing-section-kicker">Built in modules</p><h2 id="modules-title">One bot. Exactly the right amount of help.</h2></div>
        <div class="landing-module-list" aria-label="Available Blueprint modules"><span>Welcome</span><span>Auto roles</span><span>Audit log</span><span>Auto moderation</span><span>Join screening</span><span>Announcements</span><span>Starboard</span><span>Suggestions</span><span>Reaction roles</span><span>Tickets</span><span>Leveling</span><span>Anti-raid</span><span>Automations</span><span>Modmail</span><span>Applications</span><span>AI tools</span></div>
      </section>

      <section class="landing-closing" aria-labelledby="closing-title">
        <div class="landing-closing-glow" aria-hidden="true"></div><p class="landing-section-kicker">Your community, on your terms</p><h2 id="closing-title">Give your server a better place to grow.</h2><p>Start in the Control Center and build the setup that makes sense for your community.</p><a class="button landing-primary-action" href="/dashboard">Open Control Center <span aria-hidden="true">→</span></a>
      </section>
    </main>
  `;

  return renderLayout({
    authConfig,
    body,
    currentPath: "/",
    description:
      "Blueprint is a modular, dashboard-first Discord bot for configuring moderation, community systems, automations, tickets, and server operations with clarity.",
    pageHeading: "Your server has its own blueprint.",
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
              <span class="server-card-workspace">Server workspace</span>
            </div>
          </div>
          ${summaryHtml}
          <div class="server-card-progress">
            <strong>${escapeHtml(setupHeadline)}</strong>
          </div>
          <div class="server-card-actions">
            <span class="server-card-action-label">${guild.attentionCount > 0 ? "Setup available" : "Ready to configure"}</span>
            <span class="server-card-action-text">${escapeHtml(actionLabel)} <span aria-hidden="true">→</span></span>
          </div>
        </a>
      `;
    })
    .join("");

  const showOnboardingPanel = !discordLinked || sortedGuilds.length === 0;
  const showServerControls = discordLinked && sortedGuilds.length > 0;

  const body = `
    <main class="dashboard-page" id="main-content">
      <section class="section-header dashboard-heading">
        <div>
          <p class="eyebrow">${escapeHtml(onboardingState.dashboardEyebrow)}</p>
          <h1>${escapeHtml(onboardingState.dashboardTitle)}</h1>
          <p class="section-copy">${escapeHtml(onboardingState.dashboardCopy)}</p>
        </div>
        <div class="dashboard-heading-actions">
          ${
            showServerControls
              ? `<div class="dashboard-heading-stats" aria-label="Server status">
                  <span><strong>${sortedGuilds.length}</strong> installed</span>
                  <span class="${attentionServers ? "has-attention" : ""}"><strong>${attentionServers}</strong> need setup</span>
                  <span><strong>${readyServers}</strong> ready</span>
                </div>`
              : ""
          }
          <div class="section-actions">
            ${renderDashboardAction(
              showServerControls ? onboardingState.secondaryAction : onboardingState.primaryAction,
            )}
          </div>
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
      <section class="dashboard-toolbar ${showServerControls ? "" : "is-hidden"}">
        <label class="search-field">
          <span class="search-field-label">Find a server</span>
          <input
            type="search"
            placeholder="Search your servers"
            data-guild-search
          />
        </label>
        <div class="dashboard-toolbar-actions">
          <label class="checkbox-chip">
            <input type="checkbox" data-guild-attention-filter />
            <span>Needs setup</span>
          </label>
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
  const guildIconUrl = getGuildIconUrl(guild);
  const guildInitials = guild.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1))
    .join("")
    .toUpperCase() || "BP";
  const workspaceStatus = pageMeta?.attentionModules
    ? `${pageMeta.attentionModules} item${pageMeta.attentionModules === 1 ? "" : "s"} need attention`
    : "Setup is on track";

  const body = `
    <main class="settings-page" id="main-content">
      <section class="workspace-hero">
        <div class="workspace-context" aria-label="Breadcrumb">
          <a href="/dashboard"><span aria-hidden="true">←</span> All servers</a>
          <span aria-hidden="true">/</span>
          <span>Server workspace</span>
        </div>
        <div class="workspace-hero-body">
          <div class="workspace-server-mark" aria-hidden="true">
            ${
              guildIconUrl
                ? `<img src="${escapeHtml(guildIconUrl)}" alt="" />`
                : escapeHtml(guildInitials)
            }
          </div>
          <div class="workspace-hero-copy">
            <p class="eyebrow">Blueprint workspace</p>
            <h1>${escapeHtml(guild.name)}</h1>
            <p>
              A clear home for this server’s modules, setup tasks, and saved configuration.
            </p>
          </div>
          <div class="workspace-hero-status">
            <span class="status-pill status-pill-${pageMeta?.attentionModules ? "incomplete" : "live"}">
              <span class="workspace-status-dot" aria-hidden="true"></span>
              ${escapeHtml(workspaceStatus)}
            </span>
            <span>Changes stay scoped to this server</span>
          </div>
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
                  : "Open the module library below to review settings, make edits, and save when you are ready."
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
        <details class="module-library-disclosure">
          <summary>
            <span class="module-library-disclosure-copy">
              <span class="module-library-label">Module library</span>
              <span>Browse every module and jump straight to its settings.</span>
            </span>
            <span class="module-library-disclosure-action">Browse modules <span aria-hidden="true">↓</span></span>
          </summary>
          <div class="module-library-disclosure-body">
            <div class="module-library-toolbar">
              <div>
                <span class="module-library-label">Module library</span>
                <p>Jump straight to a system, grouped around the work your team is doing.</p>
              </div>
              <label class="module-library-filter">
                <span>Show</span>
                <select data-module-filter aria-label="Filter modules">
                  <option value="all">All modules</option>
                  <option value="needs-setup">Needs setup</option>
                  <option value="enabled">Enabled</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
            </div>
            <p class="module-library-results" data-module-library-results aria-live="polite"></p>
            <nav class="module-index-strip" aria-label="Module shortcuts">
              ${moduleIndexHtml}
            </nav>
          </div>
        </details>
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
          "Blueprint stores the service data needed to operate the website and Discord bot: an authenticated website session, the linked Discord account identifier provided by Continental ID, and per-server configuration saved through the dashboard.",
          "Server settings can include channel and role IDs, module toggles, message templates, runtime state such as leveling and ticket records, suggestion numbering, starboard references, and modmail routing mappings.",
        ],
      },
      {
        title: "Discord content",
        paragraphs: [
          "Blueprint reads the Discord metadata and message events required by the modules you enable. Ticket transcripts are sent to the Discord channel you configure, and modmail forwards member messages to the configured staff inbox; those message contents remain Discord data rather than being copied into Blueprint's settings database.",
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
          "Blueprint configuration data is used to operate the service and is not intended for resale or advertising. Web sessions expire after seven days. Guild settings and module runtime records remain until the server is removed or the operator performs the documented deletion workflow; logs and encrypted backups follow the deployment's retention policy.",
        ],
      },
      {
        title: "AI and external providers",
        paragraphs: [
          "When a server explicitly enables AI tools, the configured AI service and Continental ID access service receive the request data needed to answer the request and verify access. Blueprint does not store AI prompts or responses in its local SQLite databases. Provider retention, training use, and regional processing depend on the deployment's provider agreements and must be confirmed before public launch.",
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

const MODULE_LIBRARY_GROUPS = [
  {
    key: "safety",
    label: "Safety & oversight",
    moduleKeys: ["auditLog", "autoModeration", "joinScreening", "antiRaid"],
  },
  {
    key: "community",
    label: "Community systems",
    moduleKeys: [
      "welcome",
      "autoRole",
      "announcements",
      "starboard",
      "suggestions",
      "reactionRoles",
      "applications",
      "leveling",
    ],
  },
  {
    key: "operations",
    label: "Staff workflows",
    moduleKeys: ["countdown", "tickets", "automations", "modmail", "aiTools"],
  },
];

const MODULE_SYMBOLS = {
  aiTools: "✦",
  announcements: "〰",
  antiRaid: "⌁",
  applications: "◫",
  auditLog: "◌",
  autoModeration: "⊘",
  autoRole: "◇",
  automations: "↗",
  countdown: "◷",
  joinScreening: "◉",
  leveling: "↑",
  modmail: "✉",
  reactionRoles: "◇",
  starboard: "★",
  suggestions: "↗",
  tickets: "□",
  welcome: "✦",
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
  const modulesByKey = new Map(modules.map((module) => [module.key, module]));
  const renderedKeys = new Set();
  const groups = MODULE_LIBRARY_GROUPS.map((group) => {
    const groupModules = group.moduleKeys
      .map((moduleKey) => modulesByKey.get(moduleKey))
      .filter(Boolean);
    groupModules.forEach((module) => renderedKeys.add(module.key));

    if (!groupModules.length) {
      return "";
    }

    return `
      <section class="module-index-group module-index-group-${group.key}" data-module-group>
        <h3>${escapeHtml(group.label)}</h3>
        <div class="module-index-group-grid">
          ${groupModules.map(renderModuleIndexCard).join("")}
        </div>
      </section>
    `;
  });
  const remainingModules = modules.filter((module) => !renderedKeys.has(module.key));

  if (remainingModules.length) {
    groups.push(`
      <section class="module-index-group module-index-group-other" data-module-group>
        <h3>More tools</h3>
        <div class="module-index-group-grid">
          ${remainingModules.map(renderModuleIndexCard).join("")}
        </div>
      </section>
    `);
  }

  return groups.join("");
}

function renderModuleIndexCard(module) {
  return `
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
          <span class="module-index-name"><span class="module-index-symbol" aria-hidden="true">${getModuleSymbol(module.key)}</span><span data-module-nav-name="${escapeHtml(module.key)}">${escapeHtml(module.label)}</span></span>
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
    `;
}

function getModuleSymbol(moduleKey) {
  return MODULE_SYMBOLS[moduleKey] || "◌";
}

function getGuildIconUrl(guild) {
  if (!guild || typeof guild.iconURL !== "function") {
    return "";
  }

  return guild.iconURL({ size: 256 }) || "";
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
