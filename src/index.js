const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");

const express = require("express");
const session = require("express-session");
const {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  Client,
  DiscordAPIError,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  Partials,
  PermissionFlagsBits,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const config = require("./config");
const {
  AUTH_ERROR_CODE,
  AUTH_POPUP_MESSAGE_SOURCE,
  AUTH_POPUP_MESSAGE_TYPE,
  AUTH_POPUP_NAME,
  buildAuthErrorPayload,
  buildTrustedLoginOrigins,
  mapAuthErrorCode,
} = require("./auth-contract");
const continentalIdBrowserGlobalPath = require.resolve("@continental/id-client/browser-global");
const { createSessionStore } = require("./session-store");
const { readResponseText } = require("./http-client");
const logger = require("./logger");
const { createMetrics, formatPrometheus } = require("./metrics");
const { createRateLimiter } = require("./rate-limit");
const { normalizeReturnTo, tokensMatch } = require("./security-utils");
const {
  renderAuthComplete,
  renderDashboard,
  renderGuildSettings,
  renderHome,
  renderNotFoundPage,
  renderPrivacyPage,
  renderTermsPage,
} = require("./render");
const {
  buildCountdownAlertMessage,
  clearCountdownSettings,
  DEFAULT_DAILY_ALERT_TIME,
  getCurrentIsoDateInTimeZone,
  getCountdownAlertSummary,
  getCountdownResult,
  normalizeCountdownAlertTime,
  normalizeCountdownAlertTimeZone,
  normalizeCountdownMode,
  normalizeExcludedDatesInput,
  normalizeIsoDateInput,
  normalizeWeekdaySelection,
  shouldSendCountdownAlert,
  validateCountdownSettings,
} = require("./countdown");
const {
  assignAutoRole,
  normalizeAutoRoleSettings,
  validateAutoRoleSettings,
} = require("./modules/auto-role");
const {
  normalizeAiToolsSettings,
  validateAiToolsSettings,
} = require("./modules/ai-tools");
const {
  normalizeAntiRaidSettings,
  validateAntiRaidSettings,
} = require("./modules/anti-raid");
const {
  normalizeAnnouncementSettings,
  validateAnnouncementSettings,
} = require("./modules/announcements");
const {
  logMemberJoin,
  logMemberLeave,
  logMessageDelete,
  logRoleChange,
  normalizeAuditLogSettings,
  validateAuditLogSettings,
} = require("./modules/audit-log");
const {
  moderateMessage,
  normalizeAutoModerationSettings,
  validateAutoModerationSettings,
} = require("./modules/auto-moderation");
const {
  getAssignableRoleOptions,
  getMentionRoleOptions,
  getTextChannelOptions,
} = require("./modules/common");
const {
  evaluateDashboardModules,
  getRuntimeModuleValidationErrors,
} = require("./modules/dashboard-registry");
const {
  normalizeJoinScreeningSettings,
  screenNewMember,
  validateJoinScreeningSettings,
} = require("./modules/join-screening");
const {
  normalizeSuggestionSettings,
  validateSuggestionSettings,
} = require("./modules/suggestions");
const {
  normalizeTicketSettings,
  validateTicketSettings,
} = require("./modules/tickets");
const {
  buildStarboardPostContent,
  getStarboardReactionCount,
  isStarboardReaction,
  normalizeStarboardSettings,
  validateStarboardSettings,
} = require("./modules/starboard");
const {
  normalizeWelcomeSettings,
  sendWelcomeMessage,
  validateWelcomeSettings,
} = require("./modules/welcome");
const {
  processLevelingMessage,
} = require("./modules/leveling-runtime");
const {
  normalizeLevelingSettings,
  validateLevelingSettings,
} = require("./modules/leveling");
const {
  CLOSE_TICKET_CUSTOM_ID,
  OPEN_TICKET_CUSTOM_ID,
  closeTicket,
  createTicketForUser,
  openTicket,
  syncTicketPanel,
} = require("./modules/tickets-runtime");
const {
  normalizeReactionRoleSettings,
  validateReactionRoleSettings,
} = require("./modules/reaction-roles");
const {
  normalizeAutomationSettings,
  validateAutomationSettings,
} = require("./modules/automations");
const { normalizeModmailSettings, validateModmailSettings } = require("./modules/modmail");
const {
  canStaffReplyToModmail,
  getModmailReferenceId,
  getModmailInboundContent,
  getModmailReplyContent,
} = require("./modules/modmail-runtime");
const {
  getApplicationPrompts,
  normalizeApplicationSettings,
  validateApplicationSettings,
} = require("./modules/applications");
const {
  buildAiSessionId,
  getAiAccessRequirementMessage,
  isAiRuntimeConfigured,
  requestAiReply,
  resetAiSession,
  resolveContinentalUser,
  stripBotMention,
} = require("./ai-runtime");
const {
  clearAntiRaidLockdownState,
  clearCountdownAlertLastSentOn,
  checkStorageHealth,
  deleteStarboardEntry,
  getAutomationCooldown,
  getAntiRaidLockdownState,
  getCountdownAlertLastSentOn,
  getNextSuggestionNumber,
  getGuildSettings,
  getModmailMessageMapping,
  getStarboardEntry,
  saveGuildSettings,
  saveModmailMessageMapping,
  setCountdownAlertLastSentOn,
  setAutomationCooldown,
  setAntiRaidLockdownState,
  upsertStarboardEntry,
} = require("./storage");
const {
  DEFAULT_ANTI_RAID_SLOWMODE_SECONDS,
  createCooldownStore,
  getLockdownSlowmodeSeconds,
} = require("./runtime-utils");

const runtimeConfigValidation = config.validateRuntimeConfig();
for (const warning of runtimeConfigValidation.warnings) {
  logger.warn("configuration_warning", { warning });
}
if (runtimeConfigValidation.errors.length > 0) {
  logger.error("invalid_runtime_configuration");
  for (const error of runtimeConfigValidation.errors) {
    logger.error("configuration_error", { error });
  }
  process.exit(1);
}

const SESSION_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const COMMAND_REGISTRATION_RETRY_MS = 1000 * 60 * 5;
const DISCORD_LOGIN_RETRY_MS = 1000 * 60 * 5;
const APPLICATION_MODAL_CUSTOM_ID = "applications-submit";
const APPLICATION_ANSWER_INPUT_PREFIX = "applications-answer-";
const sessionStore = createSessionStore({
  dataDir: config.dataDir,
  ttlMs: SESSION_COOKIE_MAX_AGE_MS,
});
const metrics = createMetrics();
const authRateLimiter = createRateLimiter({
  limit: config.authRateLimitMaxRequests,
  onReject: () => metrics.increment("rate_limit_rejections_total"),
  windowMs: config.authRateLimitWindowSeconds * 1000,
});
const dashboardWriteRateLimiter = createRateLimiter({
  keyGenerator: (request) =>
    `${request.ip || "anonymous"}:${request.session.user?.id || "anonymous"}:${request.params.guildId || "unknown"}`,
  limit: config.dashboardWriteRateLimitMaxRequests,
  onReject: () => metrics.increment("rate_limit_rejections_total"),
  windowMs: config.dashboardWriteRateLimitWindowSeconds * 1000,
});
const automationCooldowns = createCooldownStore({
  getExpiry: getAutomationCooldown,
  onBlocked: () => metrics.increment("automation_cooldown_drops_total"),
  setExpiry: setAutomationCooldown,
});
const aiCooldowns = createCooldownStore({
  onBlocked: () => metrics.increment("ai_cooldown_drops_total"),
});

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with the server's configured ping response."),
  new SlashCommandBuilder()
    .setName("hello")
    .setDescription("Replies with the server's configured hello message."),
  new SlashCommandBuilder()
    .setName("dashboard")
    .setDescription("Shows the control center URL for this bot."),
  new SlashCommandBuilder()
    .setName("countdown")
    .setDescription("Shows the server's configured countdown."),
  new SlashCommandBuilder()
    .setName("ai")
    .setDescription("Ask the configured Blueprint AI helper.")
    .addStringOption((option) =>
      option
        .setName("question")
        .setDescription("What you want to ask")
        .setRequired(true)
        .setMaxLength(1500),
    ),
  new SlashCommandBuilder()
    .setName("aireset")
    .setDescription("Reset your Blueprint AI memory for this server channel."),
  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Posts a quick staff announcement in the configured announcement channel.")
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("Announcement message")
        .setRequired(true)
        .setMaxLength(1500),
    )
    .addBooleanOption((option) =>
      option
        .setName("ping")
        .setDescription("Ping the configured default role for this module"),
    ),
  new SlashCommandBuilder()
    .setName("suggest")
    .setDescription("Submits an idea to the configured suggestions channel.")
    .addStringOption((option) =>
      option
        .setName("idea")
        .setDescription("Your suggestion")
        .setRequired(true)
        .setMaxLength(1000),
    )
    .addBooleanOption((option) =>
      option
        .setName("anonymous")
        .setDescription("Hide your name in the public suggestion post"),
    ),
  new SlashCommandBuilder()
    .setName("apply")
    .setDescription("Opens the configured applications form for this server."),
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User],
});

const app = express();
const invitePermissions = new PermissionsBitField([
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.KickMembers,
]).bitfield.toString();
const addBotUrl =
  `https://discord.com/oauth2/authorize?client_id=${config.clientId}` +
  `&scope=bot%20applications.commands&permissions=${invitePermissions}`;
const authPopupStaticDir = resolveAuthPopupStaticDir();

app.set("trust proxy", config.trustProxy);
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: false, limit: "64kb" }));
app.use(
  session({
    name: config.sessionCookieName,
    store: sessionStore,
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: SESSION_COOKIE_MAX_AGE_MS,
      sameSite: "lax",
      secure: config.baseUrl.startsWith("https://"),
    },
  }),
);
app.use((request, response, next) => {
  const startedAt = Date.now();
  const correlationId = crypto.randomUUID();
  response.locals.correlationId = correlationId;
  response.set("X-Correlation-Id", correlationId);
  response.once("finish", () => {
    metrics.increment("http_requests_total");
    metrics.increment(`http_responses_${Math.floor(response.statusCode / 100)}xx_total`);
    metrics.observe("http_request", Date.now() - startedAt);
  });
  next();
});
app.use(express.static(path.join(process.cwd(), "public")));
app.use("/images", express.static(path.join(process.cwd(), "images")));
app.get("/vendor/continental-id-client.js", (request, response) => {
  response.sendFile(continentalIdBrowserGlobalPath);
});
if (authPopupStaticDir) {
  app.use("/auth-popup", express.static(authPopupStaticDir));
  app.get("/auth-popup", (request, response) => {
    response.redirect(302, "/auth-popup/popup.html");
  });
  app.get("/auth-popup/:asset", (request, response, next) => {
    const asset = path.basename(String(request.params.asset || ""));
    const assetPath = path.join(authPopupStaticDir, asset);

    if (!asset || !fs.existsSync(assetPath)) {
      next();
      return;
    }

    response.sendFile(assetPath);
  });
} else {
  logger.warn("auth_popup_assets_unavailable", {
    message: "Local Dashboard login assets were not found; /auth-popup is unavailable.",
  });
}
app.use(ensureCsrfToken);
app.use(requireTrustedOrigin);
app.get("/favicon.ico", (request, response) => {
  response.sendFile(path.join(process.cwd(), "images", "blueprint-pfp2.png"));
});
app.get("/favicon.png", (request, response) => {
  response.sendFile(path.join(process.cwd(), "images", "blueprint-pfp2.png"));
});
app.use((request, response, next) => {
  response.locals.sessionUser = request.session.user || null;
  applySecurityHeaders(response);

  if (
    request.path.startsWith("/dashboard") ||
    request.path.startsWith("/auth/") ||
    request.path === "/logout"
  ) {
    response.set("X-Robots-Tag", "noindex, nofollow");
  }

  next();
});

app.get("/", async (request, response, next) => {
  try {
    const guilds = request.session.user?.discordUserId
      ? await getManageableGuilds(request.session.user.discordUserId)
      : [];

    response.send(
      renderHome({
        addBotUrl,
        authConfig: getAuthClientConfig(request),
        guilds,
        sessionUser: response.locals.sessionUser,
      }),
    );
  } catch (error) {
    next(error);
  }
});

app.get("/privacy", (request, response) => {
  response.send(
    renderPrivacyPage({
      authConfig: getAuthClientConfig(request),
      sessionUser: response.locals.sessionUser,
    }),
  );
});

app.get("/terms", (request, response) => {
  response.send(
    renderTermsPage({
      authConfig: getAuthClientConfig(request),
      sessionUser: response.locals.sessionUser,
    }),
  );
});

app.get("/healthz", (request, response) => {
  response.json({ ok: true });
});

app.get("/readyz", (request, response) => {
  let storageReady = false;
  let sessionReady = false;
  try {
    checkStorageHealth();
    storageReady = true;
    sessionReady = sessionStore.checkHealth();
  } catch (error) {
    storageReady = false;
  }

  const botReady = client.isReady();
  const ok = botReady && storageReady && sessionReady;
  response.status(ok ? 200 : 503).json({
    botReady,
    ok,
    sessionReady,
    storageReady,
  });
});

app.get("/metrics", requireMetricsAccess, (request, response) => {
  response
    .type("text/plain; version=0.0.4")
    .set("Cache-Control", "no-store")
    .send(formatPrometheus(metrics.snapshot()));
});

app.get("/robots.txt", (request, response) => {
  response.type("text/plain").send([
    "User-agent: *",
    "Allow: /",
    "Disallow: /dashboard",
    "Disallow: /auth",
    "Disallow: /logout",
    `Sitemap: ${config.baseUrl}/sitemap.xml`,
    "",
  ].join("\n"));
});

app.get("/sitemap.xml", (request, response) => {
  const lastModified = getSitemapLastModifiedDate();
  const pages = [
    { path: "/", priority: "1.0", changefreq: "weekly", lastmod: lastModified },
    { path: "/privacy", priority: "0.4", changefreq: "yearly", lastmod: lastModified },
    { path: "/terms", priority: "0.4", changefreq: "yearly", lastmod: lastModified },
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (page) => `  <url>
    <loc>${escapeXml(`${config.baseUrl}${page.path}`)}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;
  response.type("application/xml").send(body);
});

app.get(["/security.txt", "/.well-known/security.txt"], (request, response) => {
  response.type("text/plain").send([
    "Contact: https://contact.continental-hub.com",
    `Expires: ${getSecurityTextExpiryDate()}`,
    "Preferred-Languages: en",
    `Canonical: ${config.baseUrl}/.well-known/security.txt`,
    `Policy: ${config.baseUrl}/terms`,
    "",
  ].join("\n"));
});

app.get("/site.webmanifest", (request, response) => {
  response.type("application/manifest+json").send(buildSiteManifest());
});

app.get("/manifest.json", (request, response) => {
  response.type("application/manifest+json").send(buildSiteManifest());
});

app.get("/data.json", (request, response) => {
  response.json(buildSiteData());
});

app.get("/auth/complete", (request, response) => {
  response.send(
    renderAuthComplete({
      authConfig: getAuthClientConfig(request),
      returnTo: normalizeReturnTo(request.query.returnTo),
      sessionUser: response.locals.sessionUser,
    }),
  );
});

app.post("/auth/session", authRateLimiter.middleware, requireCsrfToken, async (request, response, next) => {
  const correlationId = crypto.randomUUID();
  try {
    const accessToken = normalizeToken(request.body.accessToken);
    if (!accessToken) {
      response
        .status(400)
        .set("X-Auth-Correlation-Id", correlationId)
        .json(
          buildAuthErrorPayload({
            code: AUTH_ERROR_CODE.accessTokenMissing,
            correlationId,
            message: "Access token required.",
          }),
        );
      return;
    }

    const authPayload = await fetchAuthProfile(accessToken);
    const sessionUser = buildSessionUser(authPayload);

    await regenerateSession(request);
    request.session.accessToken = accessToken;
    request.session.user = sessionUser;
    request.session.csrfToken = crypto.randomBytes(32).toString("hex");

    response
      .set("X-Auth-Correlation-Id", correlationId)
      .json({
      authenticated: true,
      auth: {
        code: "auth/ok",
        correlationId,
        popup: {
          source: AUTH_POPUP_MESSAGE_SOURCE,
          type: AUTH_POPUP_MESSAGE_TYPE,
        },
        sessionEstablished: true,
      },
      correlationId,
      csrfToken: request.session.csrfToken,
      discordLinked: sessionUser.discordLinked,
      user: sessionUser,
    });
  } catch (error) {
    error.authCorrelationId = correlationId;
    next(error);
  }
});

app.post(
  "/auth/link/discord/start",
  authRateLimiter.middleware,
  requireAuthJson,
  requireCsrfToken,
  async (request, response, next) => {
  try {
    const payload = await fetchAuthJson("/api/auth/oauth/discord/link-start", {
      accessToken: request.session.accessToken,
      body: {
        origin: config.baseUrl,
        redirect: `${config.authCompleteUrl}?returnTo=${encodeURIComponent(
          normalizeReturnTo(request.body.returnTo),
        )}`,
        returnTo: `${config.authCompleteUrl}?returnTo=${encodeURIComponent(
          normalizeReturnTo(request.body.returnTo),
        )}`,
      },
      headers: {
        Origin: config.baseUrl,
        Referer: `${config.baseUrl}${normalizeReturnTo(request.body.returnTo)}`,
      },
      method: "POST",
    });

    response.json(payload);
  } catch (error) {
    next(error);
  }
  },
);

app.get("/logout", (request, response) => {
  response.redirect("/");
});

app.post("/logout", requireCsrfToken, (request, response, next) => {
  request.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }

    response.clearCookie(config.sessionCookieName, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.baseUrl.startsWith("https://"),
    });
    response.redirect("/");
  });
});

app.get("/dashboard", requireAuthPage, async (request, response, next) => {
  try {
    const guilds = request.session.user.discordUserId
      ? await getManageableGuilds(request.session.user.discordUserId)
      : [];

    response.send(
      renderDashboard({
        addBotUrl,
        authConfig: getAuthClientConfig(request),
        discordLinked: Boolean(request.session.user.discordLinked),
        guilds,
        sessionUser: response.locals.sessionUser,
      }),
    );
  } catch (error) {
    next(error);
  }
});

app.get("/dashboard/:guildId", requireAuthPage, async (request, response, next) => {
  try {
    const guild = await getManagedGuild(
      request.session.user.discordUserId,
      request.params.guildId,
    );

    if (!guild) {
      response.status(404).send("Server not found or not manageable.");
      return;
    }

    const dashboardOptions = await getGuildDashboardOptions(guild);
    const settings = getGuildSettings(guild.id);
    const pageMeta = buildGuildPageMeta({
      botMember: dashboardOptions.botMember,
      channelOptions: dashboardOptions.channelOptions,
      guild,
      mentionRoleOptions: dashboardOptions.mentionRoleOptions,
      roleOptions: dashboardOptions.roleOptions,
      settings,
    });

    response.send(
      renderGuildSettings({
        authConfig: getAuthClientConfig(request),
        channelOptions: dashboardOptions.channelOptions,
        guild,
        mentionRoleOptions: dashboardOptions.mentionRoleOptions,
        pageMeta,
        roleOptions: dashboardOptions.roleOptions,
        saveMessage: getSettingsSaveMessage(request.query.saved),
        sessionUser: response.locals.sessionUser,
        settings,
      }),
    );
  } catch (error) {
    next(error);
  }
});

app.post(
  "/dashboard/:guildId",
  dashboardWriteRateLimiter.middleware,
  requireAuthPage,
  requireCsrfToken,
  async (request, response, next) => {
  try {
    const guild = await getManagedGuild(
      request.session.user.discordUserId,
      request.params.guildId,
    );

    if (!guild) {
      response.status(404).send("Server not found or not manageable.");
      return;
    }

    const dashboardOptions = await getGuildDashboardOptions(guild);
    const settings = {
      pingResponse: normalizeText(request.body.pingResponse, "Pong.", 120),
      helloEnabled: request.body.helloEnabled === "on",
      helloTemplate: normalizeText(request.body.helloTemplate, "Hello, {user}.", 160),
      accentColor: normalizeColor(request.body.accentColor),
      countdownEnabled: request.body.countdownEnabled === "on",
      countdownTitle: normalizeText(request.body.countdownTitle, "", 80),
      countdownTargetDate: normalizeIsoDateInput(request.body.countdownTargetDate),
      countdownMode: normalizeCountdownMode(request.body.countdownMode),
      countdownWeekdays: normalizeWeekdaySelection(request.body.countdownWeekdays),
      countdownExcludedDates: normalizeExcludedDatesInput(
        request.body.countdownExcludedDates,
      ),
      countdownAlertEnabled: request.body.countdownAlertEnabled === "on",
      countdownAlertChannelId: normalizeId(request.body.countdownAlertChannelId),
      countdownAlertTime: normalizeCountdownAlertTime(
        request.body.countdownAlertTime,
        DEFAULT_DAILY_ALERT_TIME,
      ),
      countdownAlertTimeZone: normalizeCountdownAlertTimeZone(
        request.body.countdownAlertTimeZone,
      ),
      ...normalizeWelcomeSettings(request.body),
      ...normalizeAutoRoleSettings(request.body),
      ...normalizeAuditLogSettings(request.body),
      ...normalizeAutoModerationSettings(request.body),
      ...normalizeJoinScreeningSettings(request.body),
      ...normalizeAnnouncementSettings(request.body),
      ...normalizeStarboardSettings(request.body),
      ...normalizeSuggestionSettings(request.body),
      ...normalizeTicketSettings(request.body),
      ...normalizeLevelingSettings(request.body),
      ...normalizeReactionRoleSettings(request.body),
      ...normalizeAntiRaidSettings(request.body),
      ...normalizeAutomationSettings(request.body),
      ...normalizeModmailSettings(request.body),
      ...normalizeApplicationSettings(request.body),
      ...normalizeAiToolsSettings(request.body),
    };
    const botMember = await getBotGuildMember(guild);
    const validationErrors = [
      ...validateCountdownSettings(settings, guild, botMember),
      ...validateWelcomeSettings(settings, guild, botMember),
      ...validateAutoRoleSettings(settings, guild, botMember),
      ...validateAuditLogSettings(settings, guild, botMember),
      ...validateAutoModerationSettings(settings, guild, botMember),
      ...validateJoinScreeningSettings(settings, guild, botMember),
      ...validateAnnouncementSettings(settings, guild, botMember),
      ...validateStarboardSettings(settings, guild, botMember),
      ...validateSuggestionSettings(settings, guild, botMember),
      ...validateTicketSettings(settings, guild, botMember),
      ...validateLevelingSettings(settings, guild, botMember),
      ...validateReactionRoleSettings(settings, guild, botMember),
      ...validateAntiRaidSettings(settings, guild, botMember),
      ...validateAutomationSettings(settings, guild, botMember),
      ...validateModmailSettings(settings, guild, botMember),
      ...validateApplicationSettings(settings, guild, botMember),
      ...validateAiToolsSettings(settings, guild, botMember),
      ...getRuntimeModuleValidationErrors(settings),
    ];
    const pageMeta = buildGuildPageMeta({
      botMember,
      channelOptions: dashboardOptions.channelOptions,
      guild,
      mentionRoleOptions: dashboardOptions.mentionRoleOptions,
      roleOptions: dashboardOptions.roleOptions,
      settings,
    });

    if (validationErrors.length > 0) {
      response.status(400).send(
        renderGuildSettings({
          authConfig: getAuthClientConfig(request),
          channelOptions: dashboardOptions.channelOptions,
          errorMessage: validationErrors[0],
          guild,
          mentionRoleOptions: dashboardOptions.mentionRoleOptions,
          pageMeta,
          roleOptions: dashboardOptions.roleOptions,
          saveMessage: "",
          sessionUser: response.locals.sessionUser,
          settings,
        }),
      );
      return;
    }

    saveGuildSettings(
      guild.id,
      settings,
      request.session.user.id,
    );

    if (!settings.antiRaidEnabled) {
      await releaseAntiRaidLockdown(guild.id, { force: true }).catch(() => null);
    }

    await syncTicketPanel(guild, settings).catch((error) => {
      logger.error("ticket_panel_sync_failed", { guildId: guild.id }, error);
    });

    response.redirect(`/dashboard/${guild.id}?saved=1`);
  } catch (error) {
    next(error);
  }
  },
);

app.post(
  "/dashboard/:guildId/countdown/remove",
  dashboardWriteRateLimiter.middleware,
  requireAuthPage,
  requireCsrfToken,
  async (request, response, next) => {
  try {
    const guild = await getManagedGuild(
      request.session.user.discordUserId,
      request.params.guildId,
    );

    if (!guild) {
      response.status(404).send("Server not found or not manageable.");
      return;
    }

    saveGuildSettings(
      guild.id,
      clearCountdownSettings(getGuildSettings(guild.id)),
      request.session.user.id,
    );
    clearCountdownAlertLastSentOn(guild.id);

    response.redirect(`/dashboard/${guild.id}?saved=countdown-removed`);
  } catch (error) {
    next(error);
  }
  },
);

app.use((request, response) => {
  response.status(404).send(
    renderNotFoundPage({
      authConfig: getAuthClientConfig(request),
      sessionUser: response.locals.sessionUser,
    }),
  );
});

app.use((error, request, response, next) => {
  const correlationId =
    error.authCorrelationId || response.locals.correlationId || crypto.randomUUID();
  metrics.increment("request_failures_total");
  if (request.path.startsWith("/auth/")) {
    metrics.increment("auth_failures_total");
  }
  const authCode =
    error.code ||
    (typeof error.statusCode === "number" ? mapAuthErrorCode(error.statusCode) : null);
  logger.error(
    "request_failed",
    {
      code: authCode || "",
      correlationId,
      method: request.method,
      path: request.path,
      statusCode: error.statusCode || 500,
    },
    error,
  );

  if (response.headersSent) {
    next(error);
    return;
  }

  if (error.type === "entity.too.large") {
    response.status(413).send("Request payload too large.");
    return;
  }

  if (error.statusCode === 401) {
    if (request.path.startsWith("/auth/")) {
      response
        .status(401)
        .set("X-Auth-Correlation-Id", correlationId)
        .json(
          buildAuthErrorPayload({
            code: authCode || AUTH_ERROR_CODE.invalidAccessToken,
            correlationId,
            message: error.message || "Authentication required.",
          }),
        );
      return;
    }

    request.session.destroy(() => {
      response.redirect(
        `/auth/complete?returnTo=${encodeURIComponent(
          normalizeReturnTo(request.originalUrl || "/dashboard"),
        )}`,
      );
    });
    return;
  }

  if (request.path.startsWith("/auth/")) {
    const statusCode = error.statusCode || 500;
    response
      .status(statusCode)
      .set("X-Auth-Correlation-Id", correlationId)
      .json(
        buildAuthErrorPayload({
          code: authCode || AUTH_ERROR_CODE.sessionSyncFailed,
          correlationId,
          message: error.message || "Authentication failed.",
          retryable: statusCode >= 500,
        }),
      );
    return;
  }

  response.status(500).send("Something went wrong.");
});

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(config.token);
  const body = commands.map((command) => command.toJSON());

  if (config.guildId) {
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
      body,
    });
    logger.info("slash_commands_registered", {
      commandCount: body.length,
      scope: "guild",
    });
    return;
  }

  await rest.put(Routes.applicationCommands(config.clientId), { body });
  logger.info("slash_commands_registered", {
    commandCount: body.length,
    scope: "global",
  });
}

let commandRegistrationInFlight = false;
let commandRegistrationRetryTimer = null;

async function registerCommandsWithRetry() {
  if (commandRegistrationInFlight) {
    return;
  }

  commandRegistrationInFlight = true;

  try {
    await registerCommands();
    if (commandRegistrationRetryTimer) {
      clearTimeout(commandRegistrationRetryTimer);
      commandRegistrationRetryTimer = null;
    }
  } catch (error) {
    logger.error("slash_command_registration_failed", {}, error);

    if (!commandRegistrationRetryTimer) {
      commandRegistrationRetryTimer = setTimeout(() => {
        commandRegistrationRetryTimer = null;
        void registerCommandsWithRetry();
      }, COMMAND_REGISTRATION_RETRY_MS);
    }
  } finally {
    commandRegistrationInFlight = false;
  }
}

client.once(Events.ClientReady, (readyClient) => {
  logger.info("discord_ready", { username: readyClient.user.tag });
  void registerCommandsWithRetry();
  startCountdownAlertScheduler();
  restoreActiveAntiRaidLockdowns().catch((error) => {
    logger.error("anti_raid_restore_failed", {}, error);
  });
  syncTicketPanelsForClient().catch((error) => {
    logger.error("ticket_panel_sync_failed", {}, error);
  });
});

client.on(Events.Error, (error) => {
  logger.error("discord_client_error", {}, error);
});

client.on(Events.Warn, (message) => {
  logger.warn("discord_warning", { message });
});

client.on(Events.ShardError, (error, shardId) => {
  logger.error("discord_shard_error", { shardId }, error);
});

client.on(Events.ShardDisconnect, (event, shardId) => {
  logger.warn("discord_shard_disconnected", {
    code: event?.code,
    shardId,
  });
});

client.on(Events.ShardReconnecting, (shardId) => {
  logger.info("discord_shard_reconnecting", { shardId });
});

client.on(Events.ShardReady, (shardId) => {
  logger.info("discord_shard_ready", { shardId });
});

client.on(Events.ShardResume, (shardId, replayedEvents) => {
  logger.info("discord_shard_resumed", { replayedEvents, shardId });
});

client.on(Events.Invalidated, () => {
  logger.error("discord_session_invalidated");
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
      return;
    }

    if (!interaction.isChatInputCommand()) {
      return;
    }

    await handleCommand(interaction);
  } catch (error) {
    logger.error("interaction_handling_failed", {}, error);
    await replyWithRuntimeError(interaction);
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  const settings = getGuildSettings(member.guild.id);
  await runIsolatedGuildTask(member.guild.id, "anti-raid evaluation", () =>
    evaluateAntiRaid(member.guild, settings),
  );
  const screening = await runIsolatedGuildTask(
    member.guild.id,
    "join screening",
    () => screenNewMember(member, settings),
    { preventedOnboarding: false },
  );
  await runIsolatedGuildTask(member.guild.id, "member join audit log", () =>
    logMemberJoin(member, settings),
  );
  if (screening?.preventedOnboarding) {
    return;
  }

  await runIsolatedGuildTask(member.guild.id, "auto role assignment", () =>
    assignAutoRole(member, settings),
  );
  await runIsolatedGuildTask(member.guild.id, "welcome message", () =>
    sendWelcomeMessage(member, settings),
  );
  await runIsolatedGuildTask(member.guild.id, "member join automation", () =>
    runMemberJoinAutomation(member, settings),
  );
});

client.on(Events.GuildMemberRemove, async (member) => {
  const settings = getGuildSettings(member.guild.id);
  await runIsolatedGuildTask(member.guild.id, "member leave audit log", () =>
    logMemberLeave(member, settings),
  );
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  const settings = getGuildSettings(newMember.guild.id);
  await runIsolatedGuildTask(newMember.guild.id, "member role audit log", () =>
    logRoleChange(oldMember, newMember, settings),
  );
});

client.on(Events.MessageDelete, async (message) => {
  if (!message.guild) {
    return;
  }

  const settings = getGuildSettings(message.guild.id);
  await runIsolatedGuildTask(message.guild.id, "message delete audit log", () =>
    logMessageDelete(message, settings),
  );
  await runIsolatedGuildTask(message.guild.id, "starboard cleanup", () =>
    removeStarboardEntryForSourceMessage(message),
  );
});

client.on(Events.MessageCreate, async (message) => {
  if (!message.guild) {
    await runIsolatedTask("modmail inbound routing", () => handleModmailInbound(message));
    return;
  }

  const modmailReply = await runIsolatedGuildTask(
    message.guild.id,
    "modmail staff reply",
    () => handleModmailStaffReply(message),
    { handled: false },
  );
  if (modmailReply?.handled) {
    return;
  }

  const settings = getGuildSettings(message.guild.id);
  const moderationResult = await runIsolatedGuildTask(
    message.guild.id,
    "auto moderation",
    () => moderateMessage(message, settings),
    { moderated: false, reasons: [] },
  );
  if (moderationResult?.moderated) {
    return;
  }

  await runIsolatedGuildTask(message.guild.id, "keyword automation", () =>
    runKeywordAutomation(message, settings),
  );
  await runIsolatedGuildTask(message.guild.id, "leveling runtime", () =>
    processLevelingMessage(message, settings),
  );
  await runIsolatedGuildTask(message.guild.id, "AI tools runtime", () =>
    handleAiToolsMessage(message, settings),
  );
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  const guildId = reaction.message?.guildId || reaction.message?.guild?.id || "unknown";
  await runIsolatedGuildTask(guildId, "starboard reaction add", () =>
    syncStarboardReaction(reaction, user),
  );
  await runIsolatedGuildTask(guildId, "reaction role add", () =>
    syncReactionRole(reaction, user, false),
  );
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
  const guildId = reaction.message?.guildId || reaction.message?.guild?.id || "unknown";
  await runIsolatedGuildTask(guildId, "starboard reaction remove", () =>
    syncStarboardReaction(reaction, user),
  );
  await runIsolatedGuildTask(guildId, "reaction role remove", () =>
    syncReactionRole(reaction, user, true),
  );
});

async function runIsolatedTask(label, task, fallbackValue = undefined) {
  const correlationId = crypto.randomUUID();
  const metricLabel = label.replace(/\s+for guild\s+\d{16,20}$/i, "");
  metrics.increment(`module_${metricLabel}_attempts_total`);
  try {
    return await task();
  } catch (error) {
    metrics.increment("isolated_task_failures_total");
    metrics.increment(`module_${metricLabel}_failures_total`);
    logger.error("isolated_task_failed", { correlationId, label }, error);
    return fallbackValue;
  }
}

async function runIsolatedGuildTask(guildId, label, task, fallbackValue = undefined) {
  return runIsolatedTask(`${label} for guild ${guildId}`, task, fallbackValue);
}

async function replyWithRuntimeError(interaction) {
  if (!interaction || typeof interaction.reply !== "function") {
    return;
  }

  const payload = {
    content: "Something went wrong while handling that action. Try again in a moment.",
    ephemeral: true,
  };

  if (interaction.deferred) {
    await interaction.editReply(payload).catch(() => null);
    return;
  }

  if (interaction.replied) {
    await interaction.followUp(payload).catch(() => null);
    return;
  }

  await interaction.reply(payload).catch(() => null);
}

/**
 * @param {ChatInputCommandInteraction} interaction
 */
async function handleCommand(interaction) {
  const settings = interaction.guildId ? getGuildSettings(interaction.guildId) : null;

  if (interaction.commandName === "ping") {
    await interaction.reply(settings?.pingResponse || "Pong.");
    return;
  }

  if (interaction.commandName === "hello") {
    if (interaction.guildId && settings && !settings.helloEnabled) {
      await interaction.reply({
        content: "The hello command is disabled in this server.",
        ephemeral: true,
      });
      return;
    }

    const template = settings?.helloTemplate || "Hello, {user}.";
    const message = template
      .replaceAll("{user}", interaction.user.username)
      .replaceAll("{server}", interaction.guild?.name || "this server");

    await interaction.reply(message);
    return;
  }

  if (interaction.commandName === "dashboard") {
    await interaction.reply(`Control center: ${config.baseUrl}`);
    return;
  }

  if (interaction.commandName === "countdown") {
    const countdown = getCountdownResult(settings || {});
    await interaction.reply({
      content: countdown.commandPreview,
      ephemeral: countdown.state === "disabled" || countdown.state === "incomplete",
    });
    return;
  }

  if (interaction.commandName === "ai") {
    await handleAiCommand(interaction, settings);
    return;
  }

  if (interaction.commandName === "aireset") {
    await handleAiResetCommand(interaction, settings);
    return;
  }

  if (interaction.commandName === "announce") {
    await handleAnnouncementCommand(interaction);
    return;
  }

  if (interaction.commandName === "suggest") {
    await handleSuggestionCommand(interaction);
    return;
  }
  if (interaction.commandName === "apply") {
    await handleApplicationCommand(interaction);
    return;
  }

  await interaction.reply({
    content: "Unknown command.",
    ephemeral: true,
  });
}

async function handleButtonInteraction(interaction) {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({
      content: "This action only works inside a server.",
      ephemeral: true,
    });
    return;
  }

  const settings = getGuildSettings(interaction.guild.id);
  const botMember = await getBotGuildMember(interaction.guild).catch(() => null);

  if (interaction.customId === OPEN_TICKET_CUSTOM_ID) {
    await interaction.deferReply({ ephemeral: true });
    const result = await openTicket(interaction, settings, botMember);
    await interaction.editReply(result);
    return;
  }

  if (interaction.customId === CLOSE_TICKET_CUSTOM_ID) {
    await interaction.deferReply({ ephemeral: true });
    const result = await closeTicket(interaction, settings);
    await interaction.editReply(result || "Ticket closed.");
  }
}

async function handleModalSubmit(interaction) {
  if (interaction.customId === APPLICATION_MODAL_CUSTOM_ID) {
    await handleApplicationModalSubmit(interaction);
  }
}

async function handleAnnouncementCommand(interaction) {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({
      content: "Announcements can only be used inside a server.",
      ephemeral: true,
    });
    return;
  }

  if (!memberCanManageServer(interaction)) {
    await interaction.reply({
      content: "You need Manage Server or Administrator to publish announcements.",
      ephemeral: true,
    });
    return;
  }

  await interaction.guild.channels.fetch();
  await interaction.guild.roles.fetch();

  const settings = getGuildSettings(interaction.guildId);
  const botMember = await getBotGuildMember(interaction.guild);
  const errors = validateAnnouncementSettings(settings, interaction.guild, botMember);
  if (!settings.announcementsEnabled || errors.length > 0) {
    await interaction.reply({
      content: errors[0] || "Announcements are disabled in this server.",
      ephemeral: true,
    });
    return;
  }

  const channel = interaction.guild.channels.cache.get(settings.announcementsChannelId);
  const message = normalizeText(
    interaction.options.getString("message", true),
    "",
    1500,
  );
  const shouldPing = interaction.options.getBoolean("ping") === true;
  const roleId = settings.announcementsDefaultRoleId;

  if (shouldPing && !roleId) {
    await interaction.reply({
      content: "This server has no default announcement role configured to ping.",
      ephemeral: true,
    });
    return;
  }

  const content = shouldPing && roleId ? `<@&${roleId}>\n${message}` : message;

  await channel.send({
    allowedMentions: shouldPing && roleId ? { parse: [], roles: [roleId] } : { parse: [] },
    content,
  });

  await interaction.reply({
    content: `Announcement posted in <#${channel.id}>.`,
    ephemeral: true,
  });
}

async function handleSuggestionCommand(interaction) {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({
      content: "Suggestions can only be submitted inside a server.",
      ephemeral: true,
    });
    return;
  }

  await interaction.guild.channels.fetch();
  const settings = getGuildSettings(interaction.guildId);
  const botMember = await getBotGuildMember(interaction.guild);
  const errors = validateSuggestionSettings(settings, interaction.guild, botMember);
  if (!settings.suggestionsEnabled || errors.length > 0) {
    await interaction.reply({
      content: errors[0] || "Suggestions are disabled in this server.",
      ephemeral: true,
    });
    return;
  }

  const idea = normalizeText(interaction.options.getString("idea", true), "", 1000);
  const anonymous = interaction.options.getBoolean("anonymous") === true;
  if (anonymous && !settings.suggestionsAnonymousAllowed) {
    await interaction.reply({
      content: "Anonymous suggestions are disabled in this server.",
      ephemeral: true,
    });
    return;
  }

  const publicChannel = interaction.guild.channels.cache.get(settings.suggestionsChannelId);
  const reviewChannel = interaction.guild.channels.cache.get(settings.suggestionsReviewChannelId);
  const suggestionNumber = getNextSuggestionNumber(interaction.guildId);
  const publicLines = [
    `Suggestion #${suggestionNumber}`,
    anonymous ? "Submitted by: Anonymous" : `Submitted by: <@${interaction.user.id}>`,
    "",
    idea,
  ];
  const reviewLines = [
    `Suggestion #${suggestionNumber} review copy`,
    `Author: ${interaction.user.tag} (${interaction.user.id})`,
    anonymous ? "Public display: Anonymous" : "Public display: Named",
    "",
    idea,
  ];

  await publicChannel.send({
    allowedMentions: anonymous ? { parse: [] } : { parse: [], users: [interaction.user.id] },
    content: publicLines.join("\n"),
  });

  if (reviewChannel && reviewChannel.id !== publicChannel.id) {
    await reviewChannel.send({
      allowedMentions: { parse: [] },
      content: reviewLines.join("\n"),
    });
  }

  await interaction.reply({
    content: `Suggestion #${suggestionNumber} posted in <#${publicChannel.id}>.`,
    ephemeral: true,
  });

  await runSuggestionAutomation(interaction.guild, settings, {
    member: interaction.member,
    suggestionNumber,
    userTag: interaction.user.tag,
  });
}

async function handleApplicationCommand(interaction) {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({
      content: "Applications can only be submitted inside a server.",
      ephemeral: true,
    });
    return;
  }

  await interaction.guild.channels.fetch();
  await interaction.guild.roles.fetch();
  const settings = getGuildSettings(interaction.guildId);
  const botMember = await getBotGuildMember(interaction.guild).catch(() => null);
  const errors = validateApplicationSettings(settings, interaction.guild, botMember);
  if (!settings.applicationsEnabled || errors.length > 0) {
    await interaction.reply({
      content: errors[0] || "Applications are disabled in this server.",
      ephemeral: true,
    });
    return;
  }

  const prompts = getApplicationPrompts(settings);
  if (prompts.length === 0 || prompts.length > 5) {
    await interaction.reply({
      content: "Applications need between 1 and 5 prompts before members can submit the form.",
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(APPLICATION_MODAL_CUSTOM_ID)
    .setTitle(normalizeText(settings.applicationsFormTitle, "Application", 45));

  for (const [index, prompt] of prompts.entries()) {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(`${APPLICATION_ANSWER_INPUT_PREFIX}${index}`)
          .setLabel(normalizeText(prompt, `Prompt ${index + 1}`, 45))
          .setMaxLength(500)
          .setRequired(true)
          .setStyle(TextInputStyle.Paragraph),
      ),
    );
  }

  await interaction.showModal(modal);
}

async function handleApplicationModalSubmit(interaction) {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({
      content: "Applications can only be submitted inside a server.",
      ephemeral: true,
    });
    return;
  }

  await interaction.guild.channels.fetch();
  await interaction.guild.roles.fetch();
  const settings = getGuildSettings(interaction.guildId);
  const botMember = await getBotGuildMember(interaction.guild).catch(() => null);
  const errors = validateApplicationSettings(settings, interaction.guild, botMember);
  if (!settings.applicationsEnabled || errors.length > 0) {
    await interaction.reply({
      content: errors[0] || "Applications are disabled in this server.",
      ephemeral: true,
    });
    return;
  }

  const prompts = getApplicationPrompts(settings);
  if (prompts.length === 0 || prompts.length > 5) {
    await interaction.reply({
      content: "Applications need between 1 and 5 prompts before members can submit the form.",
      ephemeral: true,
    });
    return;
  }

  const destination = interaction.guild.channels.cache.get(settings.applicationsChannelId);
  const answers = prompts.map((prompt, index) => ({
    answer: normalizeText(
      interaction.fields.getTextInputValue(`${APPLICATION_ANSWER_INPUT_PREFIX}${index}`),
      "",
      500,
    ),
    prompt,
  }));

  await destination.send({
    allowedMentions: { parse: [], roles: [settings.applicationsReviewerRoleId] },
    content: [
      `**${settings.applicationsFormTitle}**`,
      `Submitted by: <@${interaction.user.id}>`,
      settings.applicationsReviewerRoleId
        ? `Reviewer role: <@&${settings.applicationsReviewerRoleId}>`
        : "",
      "",
      ...answers.flatMap(({ prompt, answer }) => [`**${prompt}**`, answer, ""]),
    ]
      .filter(Boolean)
      .join("\n"),
  });

  await interaction.reply({
    content: `Application submitted to <#${destination.id}>.`,
    ephemeral: true,
  });
}

async function handleAiCommand(interaction, settings) {
  if (!interaction.inGuild() || !interaction.guild || !settings) {
    await interaction.reply({
      content: "Blueprint AI is only available inside configured servers.",
      ephemeral: true,
    });
    return;
  }

  const availabilityError = getAiAvailabilityError(settings);
  if (availabilityError) {
    await interaction.reply({
      content: availabilityError,
      ephemeral: true,
    });
    return;
  }

  const botMember = await getBotGuildMember(interaction.guild).catch(() => null);
  const validationErrors = validateAiToolsSettings(settings, interaction.guild, botMember);
  if (validationErrors.length > 0) {
    await interaction.reply({
      content: validationErrors[0],
      ephemeral: true,
    });
    return;
  }

  if (interaction.channelId !== settings.aiToolsChannelId) {
    await interaction.reply({
      content: `Use Blueprint AI in <#${settings.aiToolsChannelId}>.`,
      ephemeral: true,
    });
    return;
  }

  const aiSessionId = buildAiSessionId(
    interaction.guildId,
    interaction.channelId,
    interaction.user.id,
  );
  if (!aiCooldowns.consume(aiSessionId, config.aiRequestCooldownSeconds)) {
    await interaction.reply({
      content: "Please wait a moment before sending another AI request.",
      ephemeral: true,
    });
    return;
  }

  const accessError = await getAiAccessError(interaction.user.id);
  if (accessError) {
    await interaction.reply({
      content: accessError,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();
  const reply = await requestAiReply({
    persona: settings.aiToolsPersona,
    question: normalizeText(interaction.options.getString("question", true), "", 1500),
    runtimeConfig: config,
    sessionId: aiSessionId,
    userId: interaction.user.id,
    username: interaction.user.tag,
  });
  logAiProviderResult(reply, {
    channelId: interaction.channelId,
    guildId: interaction.guildId,
    userId: interaction.user.id,
  });

  await interaction.editReply({
    allowedMentions: { parse: [] },
    content: formatAiReplyContent(reply),
  });
}

async function handleAiResetCommand(interaction, settings) {
  if (!interaction.inGuild() || !interaction.guild || !settings) {
    await interaction.reply({
      content: "Blueprint AI memory can only be reset inside configured servers.",
      ephemeral: true,
    });
    return;
  }

  const availabilityError = getAiAvailabilityError(settings);
  if (availabilityError) {
    await interaction.reply({
      content: availabilityError,
      ephemeral: true,
    });
    return;
  }

  const botMember = await getBotGuildMember(interaction.guild).catch(() => null);
  const validationErrors = validateAiToolsSettings(settings, interaction.guild, botMember);
  if (validationErrors.length > 0) {
    await interaction.reply({
      content: validationErrors[0],
      ephemeral: true,
    });
    return;
  }

  if (interaction.channelId !== settings.aiToolsChannelId) {
    await interaction.reply({
      content: `Reset AI memory from <#${settings.aiToolsChannelId}>.`,
      ephemeral: true,
    });
    return;
  }

  const accessError = await getAiAccessError(interaction.user.id);
  if (accessError) {
    await interaction.reply({
      content: accessError,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const result = await resetAiSession(
    buildAiSessionId(interaction.guildId, interaction.channelId, interaction.user.id),
    config,
  );

  if (!result.ok) {
    logger.error("ai_session_reset_failed", {
      channelId: interaction.channelId,
      guildId: interaction.guildId,
      statusCode: result.status || 0,
      userId: interaction.user.id,
    });
  }

  if (result.ok) {
    await interaction.editReply("AI session memory reset for this channel.");
    return;
  }

  await interaction.editReply(
    result.error
      ? `Could not reset AI session memory right now. ${result.error}`
      : `Could not reset AI session memory (HTTP ${result.status || "unknown"}).`,
  );
}

async function handleAiToolsMessage(message, settings) {
  if (
    !settings.aiToolsEnabled ||
    !message.guild ||
    !message.author ||
    !message.member ||
    message.author.bot ||
    !client.user
  ) {
    return;
  }

  if (message.channelId !== settings.aiToolsChannelId) {
    return;
  }

  const botMember = await getBotGuildMember(message.guild).catch(() => null);
  const validationErrors = validateAiToolsSettings(settings, message.guild, botMember);
  if (validationErrors.length > 0) {
    return;
  }

  let question = normalizeText(message.content, "", 1500);
  if (settings.aiToolsRequireMention) {
    if (!message.mentions.has(client.user.id)) {
      return;
    }
    question = stripBotMention(question, client.user.id);
  }

  if (!question) {
    return;
  }

  const aiSessionId = buildAiSessionId(
    message.guild.id,
    message.channelId,
    message.author.id,
  );
  if (!aiCooldowns.consume(aiSessionId, config.aiRequestCooldownSeconds)) {
    return;
  }

  const accessError = await getAiAccessError(message.author.id);
  if (accessError) {
    await message.reply({
      allowedMentions: { parse: [] },
      content: accessError,
    }).catch(() => null);
    return;
  }

  await message.channel.sendTyping().catch(() => null);
  const reply = await requestAiReply({
    persona: settings.aiToolsPersona,
    question,
    runtimeConfig: config,
    sessionId: aiSessionId,
    userId: message.author.id,
    username: message.author.tag,
  });
  logAiProviderResult(reply, {
    channelId: message.channelId,
    guildId: message.guild.id,
    userId: message.author.id,
  });

  await message.reply({
    allowedMentions: { parse: [] },
    content: formatAiReplyContent(reply),
  }).catch(() => null);
}

async function handleModmailInbound(message) {
  if (!message.author || message.author.bot || !client.user || message.author.id === client.user.id) {
    return;
  }

  for (const guild of client.guilds.cache.values()) {
    try {
      const member = await guild.members.fetch(message.author.id).catch(() => null);
      if (!member) {
        continue;
      }

      const settings = getGuildSettings(guild.id);
      if (!settings.modmailEnabled) {
        continue;
      }

      const botMember = await getBotGuildMember(guild).catch(() => null);
      const errors = validateModmailSettings(settings, guild, botMember);
      if (errors.length > 0) {
        continue;
      }

      const inboxChannel = guild.channels.cache.get(settings.modmailInboxChannelId);
      if (!inboxChannel || !inboxChannel.isTextBased()) {
        continue;
      }

      const forwardedMessage = await inboxChannel.send({
        allowedMentions: settings.modmailStaffRoleId
          ? { parse: [], roles: [settings.modmailStaffRoleId] }
          : { parse: [] },
        content: [
          settings.modmailStaffRoleId ? `<@&${settings.modmailStaffRoleId}>` : "",
          `📩 **Modmail** from ${message.author.tag} (${message.author.id})`,
          "",
          getModmailInboundContent(message),
        ]
          .filter(Boolean)
          .join("\n"),
      });
      saveModmailMessageMapping({
        guildId: guild.id,
        inboxMessageId: forwardedMessage.id,
        userId: message.author.id,
        userTag: message.author.tag,
      });

      if (settings.modmailAutoReply) {
        await message.reply({
          allowedMentions: { parse: [] },
          content: settings.modmailAutoReply,
        }).catch(() => null);
      }
      return;
    } catch (error) {
      logger.error("modmail_routing_failed", { guildId: guild.id }, error);
    }
  }
}

async function handleModmailStaffReply(message) {
  const referenceId = getModmailReferenceId(message);
  if (!referenceId) {
    return { handled: false };
  }

  const mapping = getModmailMessageMapping(referenceId);
  if (!mapping) {
    return { handled: false };
  }

  const settings = getGuildSettings(message.guild.id);
  const staffMember = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!canStaffReplyToModmail(message, settings, mapping, staffMember)) {
    return { handled: false };
  }

  const content = getModmailReplyContent(message);
  if (!content) {
    await message.reply({
      allowedMentions: { parse: [] },
      content: "Write a text reply to deliver to the member.",
    }).catch(() => null);
    return { handled: true };
  }

  const user = await client.users.fetch(mapping.userId).catch(() => null);
  if (!user) {
    await message.reply({
      allowedMentions: { parse: [] },
      content: "Blueprint could not find that member's Discord account.",
    }).catch(() => null);
    return { handled: true };
  }

  try {
    await user.send({
      allowedMentions: { parse: [] },
      content: `💬 Staff reply from ${message.author.tag}:\n${content}`,
    });
    await message.react("✅").catch(() => null);
  } catch (error) {
    logger.error(
      "modmail_reply_delivery_failed",
      { guildId: mapping.guildId, userId: mapping.userId },
      error,
    );
    await message.reply({
      allowedMentions: { parse: [] },
      content: "Blueprint could not deliver that reply. The member may have DMs disabled.",
    }).catch(() => null);
  }

  return { handled: true };
}

async function syncStarboardReaction(reaction, user) {
  if (user?.bot) {
    return;
  }

  const resolvedReaction = await hydrateReaction(reaction);
  const message = resolvedReaction?.message;
  if (!message?.guild || !message.author) {
    return;
  }

  const settings = getGuildSettings(message.guild.id);
  if (
    !settings.starboardEnabled ||
    !settings.starboardChannelId ||
    message.author.bot ||
    message.channelId === settings.starboardChannelId ||
    !isStarboardReaction(resolvedReaction.emoji)
  ) {
    return;
  }

  const starboardChannel = await getStarboardChannel(message.guild, settings.starboardChannelId);
  if (!starboardChannel || !starboardChannel.isTextBased()) {
    return;
  }

  const botMember = await getBotGuildMember(message.guild);
  if (!canSendMessages(starboardChannel, botMember)) {
    return;
  }

  const starCount = await getStarboardReactionCount(resolvedReaction, {
    allowSelfStar: settings.starboardAllowSelfStar,
    authorId: message.author.id,
  });
  const existingEntry = getStarboardEntry(message.id);

  if (starCount < settings.starboardThreshold) {
    await deleteStarboardPost(existingEntry, starboardChannel);
    return;
  }

  const payload = {
    allowedMentions: { parse: [] },
    content: buildStarboardPostContent({ message, starCount }),
  };

  if (existingEntry && existingEntry.starboardChannelId === starboardChannel.id) {
    const existingMessage = await starboardChannel.messages
      .fetch(existingEntry.starboardMessageId)
      .catch(() => null);

    if (existingMessage) {
      await existingMessage.edit(payload);
      return;
    }
  }

  if (existingEntry && existingEntry.starboardChannelId !== starboardChannel.id) {
    const previousChannel = await getStarboardChannel(message.guild, existingEntry.starboardChannelId);
    await deleteStarboardPost(existingEntry, previousChannel);
  }

  const starboardMessage = await starboardChannel.send(payload);
  upsertStarboardEntry({
    guildId: message.guild.id,
    sourceChannelId: message.channelId,
    sourceMessageId: message.id,
    starboardChannelId: starboardChannel.id,
    starboardMessageId: starboardMessage.id,
  });
}

const raidTracker = new Map();

function createAntiRaidState(persistedState = {}) {
  const previousSlowmodes = new Map(
    (persistedState.previousSlowmodes || [])
      .filter((entry) => entry && entry.channelId)
      .map((entry) => [entry.channelId, {
        applied: Math.max(0, Number(entry.applied) || 0),
        previous: Math.max(0, Number(entry.previous) || 0),
      }]),
  );

  return {
    joinTimestamps: [],
    lockedUntil: Math.max(0, Number(persistedState.lockedUntil) || 0),
    previousSlowmodes,
    unlockTimer: null,
  };
}

function persistAntiRaidState(guildId, state) {
  setAntiRaidLockdownState(guildId, {
    lockedUntil: state.lockedUntil,
    previousSlowmodes: state.previousSlowmodes,
  });
}

async function evaluateAntiRaid(guild, settings) {
  if (!settings.antiRaidEnabled) {
    return;
  }

  const now = Date.now();
  const windowMs = settings.antiRaidWindowSeconds * 1000;
  const state = raidTracker.get(guild.id) || createAntiRaidState(
    getAntiRaidLockdownState(guild.id),
  );
  state.joinTimestamps = [...state.joinTimestamps, now].filter((stamp) => now - stamp <= windowMs);
  raidTracker.set(guild.id, state);

  if (state.lockedUntil > now && state.joinTimestamps.length < settings.antiRaidJoinThreshold) {
    scheduleAntiRaidUnlock(guild.id, state);
    persistAntiRaidState(guild.id, state);
    return;
  }

  if (state.joinTimestamps.length < settings.antiRaidJoinThreshold) {
    return;
  }

  const lockdownEndsAt = now + settings.antiRaidLockdownMinutes * 60 * 1000;
  const lockdownAlreadyActive = now < state.lockedUntil;
  state.lockedUntil = lockdownEndsAt;
  raidTracker.set(guild.id, state);
  persistAntiRaidState(guild.id, state);
  scheduleAntiRaidUnlock(guild.id, state);

  if (lockdownAlreadyActive) {
    return;
  }

  const alertChannel = guild.channels.cache.get(settings.antiRaidAlertChannelId);
  if (alertChannel && alertChannel.isTextBased()) {
    await alertChannel.send({
      allowedMentions: { parse: [] },
      content: `🚨 Anti-raid triggered: ${state.joinTimestamps.length} joins within ${settings.antiRaidWindowSeconds}s. Applying temporary slowmode lockdown for ${settings.antiRaidLockdownMinutes} minute(s).`,
    }).catch((error) => {
      logger.error("anti_raid_alert_failed", { guildId: guild.id }, error);
    });
  }

  const channels = guild.channels.cache.filter(
    (channel) => channel && channel.isTextBased() && typeof channel.rateLimitPerUser === "number",
  );
  for (const channel of channels.values()) {
    if (!channel.manageable) {
      continue;
    }

    const nextSlowmode = getLockdownSlowmodeSeconds(
      channel.rateLimitPerUser,
      DEFAULT_ANTI_RAID_SLOWMODE_SECONDS,
    );
    if (nextSlowmode === channel.rateLimitPerUser) {
      continue;
    }

    if (!state.previousSlowmodes.has(channel.id)) {
      state.previousSlowmodes.set(channel.id, {
        applied: nextSlowmode,
        previous: Math.max(0, channel.rateLimitPerUser || 0),
      });
      persistAntiRaidState(guild.id, state);
    }

    await channel.setRateLimitPerUser(nextSlowmode, "Blueprint anti-raid lockdown").catch(() => null);
  }

  persistAntiRaidState(guild.id, state);
}

function scheduleAntiRaidUnlock(guildId, state) {
  if (state.unlockTimer) {
    clearTimeout(state.unlockTimer);
  }

  state.unlockTimer = setTimeout(() => {
    void releaseAntiRaidLockdown(guildId);
  }, Math.max(0, state.lockedUntil - Date.now()));
}

async function releaseAntiRaidLockdown(guildId, { force = false } = {}) {
  const state = raidTracker.get(guildId) || createAntiRaidState(
    getAntiRaidLockdownState(guildId),
  );
  if (!state) {
    return;
  }
  if (!raidTracker.has(guildId) && state.lockedUntil === 0 && state.previousSlowmodes.size === 0) {
    return;
  }
  raidTracker.set(guildId, state);

  state.unlockTimer = null;
  if (!force && state.lockedUntil > Date.now()) {
    scheduleAntiRaidUnlock(guildId, state);
    return;
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    state.previousSlowmodes.clear();
    state.lockedUntil = 0;
    raidTracker.delete(guildId);
    clearAntiRaidLockdownState(guildId);
    return;
  }

  await guild.channels.fetch().catch(() => null);
  for (const [channelId, lockdown] of state.previousSlowmodes.entries()) {
    const channel = guild.channels.cache.get(channelId);
    if (
      !channel ||
      !channel.isTextBased() ||
      typeof channel.rateLimitPerUser !== "number" ||
      !channel.manageable
    ) {
      continue;
    }

    if (channel.rateLimitPerUser !== lockdown.applied) {
      continue;
    }

    await channel.setRateLimitPerUser(
      lockdown.previous,
      "Blueprint anti-raid lockdown ended",
    ).catch(() => null);
  }

  state.previousSlowmodes.clear();
  state.lockedUntil = 0;
  raidTracker.delete(guildId);
  clearAntiRaidLockdownState(guildId);
}

async function restoreActiveAntiRaidLockdowns() {
  const now = Date.now();
  for (const guild of client.guilds.cache.values()) {
    const settings = getGuildSettings(guild.id);
    const persistedState = getAntiRaidLockdownState(guild.id);
    if (!settings.antiRaidEnabled) {
      if (persistedState.lockedUntil || persistedState.previousSlowmodes.length > 0) {
        raidTracker.set(guild.id, createAntiRaidState(persistedState));
        await releaseAntiRaidLockdown(guild.id, { force: true });
      }
      continue;
    }
    if (persistedState.lockedUntil <= now) {
      if (persistedState.lockedUntil || persistedState.previousSlowmodes.length > 0) {
        clearAntiRaidLockdownState(guild.id);
      }
      continue;
    }

    const state = createAntiRaidState(persistedState);
    raidTracker.set(guild.id, state);
    await restoreAntiRaidSlowmodes(guild, state);
    persistAntiRaidState(guild.id, state);
    scheduleAntiRaidUnlock(guild.id, state);
  }
}

async function restoreAntiRaidSlowmodes(guild, state) {
  await guild.channels.fetch().catch(() => null);
  if (state.previousSlowmodes.size === 0) {
    const channels = guild.channels.cache.filter(
      (channel) => channel && channel.isTextBased() && typeof channel.rateLimitPerUser === "number",
    );
    for (const channel of channels.values()) {
      if (!channel.manageable) {
        continue;
      }

      const nextSlowmode = getLockdownSlowmodeSeconds(
        channel.rateLimitPerUser,
        DEFAULT_ANTI_RAID_SLOWMODE_SECONDS,
      );
      if (nextSlowmode === channel.rateLimitPerUser) {
        continue;
      }

      state.previousSlowmodes.set(channel.id, {
        applied: nextSlowmode,
        previous: Math.max(0, channel.rateLimitPerUser || 0),
      });
      await channel.setRateLimitPerUser(
        nextSlowmode,
        "Blueprint anti-raid lockdown restored",
      ).catch(() => null);
    }
    return;
  }

  for (const [channelId, lockdown] of state.previousSlowmodes.entries()) {
    const channel = guild.channels.cache.get(channelId);
    if (
      !channel ||
      !channel.isTextBased() ||
      typeof channel.rateLimitPerUser !== "number" ||
      !channel.manageable
    ) {
      continue;
    }

    if (channel.rateLimitPerUser === lockdown.applied) {
      continue;
    }

    if (channel.rateLimitPerUser !== lockdown.previous) {
      continue;
    }

    await channel.setRateLimitPerUser(
      lockdown.applied,
      "Blueprint anti-raid lockdown restored",
    ).catch(() => null);
  }
}

function stopAntiRaidTracking() {
  for (const state of raidTracker.values()) {
    if (state.unlockTimer) {
      clearTimeout(state.unlockTimer);
      state.unlockTimer = null;
    }
  }
}

async function syncTicketPanelsForClient() {
  for (const guild of client.guilds.cache.values()) {
    const settings = getGuildSettings(guild.id);
    if (!settings.ticketsEnabled) {
      continue;
    }

    await guild.channels.fetch().catch(() => null);
    await syncTicketPanel(guild, settings).catch((error) => {
      logger.error("ticket_panel_sync_failed", { guildId: guild.id }, error);
    });
  }
}

async function syncReactionRole(reaction, user, isRemoval) {
  if (user?.bot) {
    return;
  }

  const resolvedReaction = await hydrateReaction(reaction);
  const message = resolvedReaction?.message;
  if (!message?.guild) {
    return;
  }

  const settings = getGuildSettings(message.guild.id);
  if (
    !settings.reactionRolesEnabled ||
    !settings.reactionRolesChannelId ||
    !settings.reactionRolesMessageId ||
    !settings.reactionRolesRoleId
  ) {
    return;
  }

  if (
    message.channelId !== settings.reactionRolesChannelId ||
    message.id !== settings.reactionRolesMessageId
  ) {
    return;
  }

  const reactionEmoji = resolvedReaction.emoji?.name || resolvedReaction.emoji?.toString?.() || "";
  if (reactionEmoji !== settings.reactionRolesEmoji) {
    return;
  }

  const member = await message.guild.members.fetch(user.id).catch(() => null);
  if (!member) {
    return;
  }
  const role = message.guild.roles.cache.get(settings.reactionRolesRoleId);
  if (!role || !role.editable) {
    return;
  }

  if (isRemoval && settings.reactionRolesRemoveOnUnreact) {
    await member.roles.remove(role, "Blueprint reaction role removed").catch(() => null);
    return;
  }

  await member.roles.add(role, "Blueprint reaction role assigned").catch(() => null);
}

async function runMemberJoinAutomation(member, settings) {
  if (!settings.automationsEnabled || settings.automationsTrigger !== "member_join") {
    return;
  }

  await executeAutomationAction(member.guild, settings, {
    member,
    source: "member_join",
  });
}

async function runKeywordAutomation(message, settings) {
  if (!settings.automationsEnabled || settings.automationsTrigger !== "keyword") {
    return;
  }

  if (!settings.automationsKeyword) {
    return;
  }

  if (!String(message.content || "").toLowerCase().includes(settings.automationsKeyword.toLowerCase())) {
    return;
  }

  await executeAutomationAction(message.guild, settings, {
    member: message.member,
    source: "keyword",
    message,
  });
}

async function runSuggestionAutomation(guild, settings, context = {}) {
  if (!settings.automationsEnabled || settings.automationsTrigger !== "suggestion_created") {
    return;
  }

  await executeAutomationAction(guild, settings, {
    source: "suggestion_created",
    context,
  });
}

async function executeAutomationAction(guild, settings, payload) {
  const logChannel = guild.channels.cache.get(settings.automationsLogChannelId);
  if (!logChannel || !logChannel.isTextBased()) {
    return;
  }

  const cooldownKey = [
    guild.id,
    settings.automationsTrigger,
    settings.automationsAction,
    settings.automationsLogChannelId,
  ].join(":");
  if (!automationCooldowns.consume(cooldownKey, settings.automationsCooldownSeconds)) {
    return;
  }

  if (settings.automationsAction === "send_message") {
    await logChannel.send({
      allowedMentions: { parse: [] },
      content: `⚙️ Automation fired (${payload.source}).`,
    });
    return;
  }

  if (settings.automationsAction === "create_ticket") {
    const opener = payload.member?.user || payload.member || payload.context?.member?.user || payload.context?.member;
    if (!opener?.id) {
      await logChannel.send({
        allowedMentions: { parse: [] },
        content: `🎫 Automation could not create a ticket for ${payload.source}: no member context was available.`,
      });
      return;
    }

    const botMember = guild.members.me || await getBotGuildMember(guild).catch(() => null);
    const context = [
      `Automation source: ${payload.source}`,
      payload.context?.suggestionNumber
        ? `Suggestion #${payload.context.suggestionNumber}`
        : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const ticket = await createTicketForUser(guild, settings, botMember, opener, { context });
    await logChannel.send({
      allowedMentions: { parse: [] },
      content: ticket.created
        ? `🎫 Automation created ${ticket.message} (${payload.source}).`
        : `🎫 Automation could not create a ticket (${payload.source}): ${ticket.message}`,
    });
    return;
  }

  if (settings.automationsAction === "assign_role" && payload.member && settings.autoRoleRoleId) {
    await payload.member.roles.add(settings.autoRoleRoleId, "Blueprint automation").catch(() => null);
    await logChannel.send({
      allowedMentions: { parse: [] },
      content: `⚙️ Automation assigned role to ${payload.member.user.tag} (${payload.source}).`,
    });
  }
}

async function removeStarboardEntryForSourceMessage(message) {
  const entry = getStarboardEntry(message.id);
  if (!entry) {
    return;
  }

  const starboardChannel = await getStarboardChannel(message.guild, entry.starboardChannelId);
  await deleteStarboardPost(entry, starboardChannel);
}

async function deleteStarboardPost(entry, starboardChannel) {
  if (!entry) {
    return;
  }

  if (starboardChannel?.isTextBased()) {
    const starboardMessage = await starboardChannel.messages
      .fetch(entry.starboardMessageId)
      .catch(() => null);

    if (starboardMessage) {
      await starboardMessage.delete().catch(() => null);
    }
  }

  deleteStarboardEntry(entry.sourceMessageId);
}

async function hydrateReaction(reaction) {
  if (reaction.partial) {
    await reaction.fetch().catch(() => null);
  }

  if (reaction.message?.partial) {
    await reaction.message.fetch().catch(() => null);
  }

  return reaction;
}

async function getStarboardChannel(guild, channelId) {
  return guild.channels.cache.get(channelId) || guild.channels.fetch(channelId).catch(() => null);
}

async function getAiAccessError(discordUserId) {
  const result = await resolveContinentalUser(discordUserId, config);
  if (!result?.ok) {
    logger.warn("continental_user_resolution_failed", {
      configured: Boolean(result?.configured),
      discordUserId,
      statusCode: result?.statusCode || 0,
    });
  }
  return getAiAccessRequirementMessage(result, config, "Blueprint AI");
}

function getAiAvailabilityError(settings) {
  if (!settings?.aiToolsEnabled) {
    return "Blueprint AI is disabled in this server.";
  }

  if (!isAiRuntimeConfigured(config)) {
    return "Blueprint AI is not configured on this instance yet.";
  }

  if (!settings.aiToolsChannelId) {
    return "Blueprint AI needs a dedicated channel before it can be used.";
  }

  return "";
}

function formatAiReplyContent(reply) {
  const answer = clampDiscordMessage(reply?.answer || "No response from the AI service.");
  if (reply?.mode === "compatibility") {
    return `AI response (compatibility mode)\n\n${answer}`;
  }
  if (reply?.mode === "error") {
    return `AI service error\n\n${answer}`;
  }
  return answer;
}

function logAiProviderResult(reply, context) {
  metrics.increment("ai_provider_requests_total");
  metrics.increment(
    reply?.mode === "error"
      ? "ai_provider_failures_total"
      : `ai_provider_${reply?.mode || "unknown"}_total`,
  );
  if (reply?.mode === "error") {
    logger.error("ai_provider_request_failed", context);
  }
}

function requireMetricsAccess(request, response, next) {
  if (!config.metricsToken) {
    response.status(404).end();
    return;
  }

  const submittedToken = String(
    request.get("x-metrics-token") ||
      request.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "",
  ).trim();
  if (!tokensMatch(config.metricsToken, submittedToken)) {
    metrics.increment("metrics_auth_failures_total");
    response.status(404).end();
    return;
  }

  next();
}

function requireAuthPage(request, response, next) {
  if (!request.session.user) {
    response.redirect(
      `/auth/complete?returnTo=${encodeURIComponent(
        normalizeReturnTo(request.originalUrl || "/dashboard"),
      )}`,
    );
    return;
  }

  next();
}

function ensureCsrfToken(request, response, next) {
  if (!request.session.csrfToken && shouldIssueCsrfToken(request)) {
    request.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }

  next();
}

function regenerateSession(request) {
  return new Promise((resolve, reject) => {
    request.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function shouldIssueCsrfToken(request) {
  if (request.method !== "GET") {
    return false;
  }

  if (
    request.path === "/robots.txt" ||
    request.path === "/sitemap.xml" ||
    request.path === "/security.txt" ||
    request.path === "/.well-known/security.txt" ||
    request.path === "/site.webmanifest" ||
    request.path === "/manifest.json" ||
    request.path === "/data.json" ||
    request.path === "/healthz" ||
    request.path === "/readyz" ||
    request.path === "/metrics" ||
    request.path.startsWith("/favicon")
  ) {
    return false;
  }

  return Boolean(request.accepts("html"));
}

function requireCsrfToken(request, response, next) {
  const submittedToken = normalizeText(
    request.get("x-csrf-token") || request.body?._csrf,
    "",
    256,
  );

  if (!tokensMatch(request.session.csrfToken, submittedToken)) {
    if (request.accepts("html")) {
      response.status(403).send("Invalid request token.");
      return;
    }

    response.status(403).json({ message: "Invalid request token." });
    return;
  }

  next();
}

function requireTrustedOrigin(request, response, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    next();
    return;
  }

  const origin = request.get("origin") || safeOriginFromUrl(request.get("referer"));
  if (!origin && !config.isProduction) {
    next();
    return;
  }

  if (origin === safeOriginFromUrl(config.baseUrl)) {
    next();
    return;
  }

  if (request.accepts("html")) {
    response.status(403).send("Untrusted request origin.");
    return;
  }

  response.status(403).json({ message: "Untrusted request origin." });
}

function applySecurityHeaders(response) {
  response.set({
    "Content-Security-Policy": [
      "default-src 'self'",
      "base-uri 'self'",
      "font-src 'self' data:",
      "frame-ancestors 'none'",
      "img-src 'self' data: https:",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "form-action 'self'",
      "connect-src 'self' https:",
    ].join("; "),
    "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  });

  if (config.baseUrl.startsWith("https://")) {
    response.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function getSecurityTextExpiryDate() {
  const nextYear = new Date();
  nextYear.setUTCFullYear(nextYear.getUTCFullYear() + 1);
  return nextYear.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function getSitemapLastModifiedDate() {
  return new Date().toISOString().slice(0, 10);
}

function buildSiteManifest() {
  return {
    background_color: "#020617",
    description:
      "Blueprint is a modular, dashboard-first Discord control center for managing server features.",
    display: "standalone",
    icons: [
      {
        sizes: "192x192",
        src: "/favicon.png",
        type: "image/png",
      },
      {
        sizes: "512x512",
        src: "/images/blueprint-pfp2.png",
        type: "image/png",
      },
    ],
    name: "Blueprint",
    short_name: "Blueprint",
    start_url: "/",
    theme_color: "#0f172a",
  };
}

function buildSiteData() {
  return {
    description:
      "Blueprint is a modular, dashboard-first Discord bot control center for moderation, automations, welcome flows, tickets, and server operations.",
    endpoints: {
      contact: "https://contact.continental-hub.com",
      privacy: "/privacy",
      robots: "/robots.txt",
      security: "/.well-known/security.txt",
      sitemap: "/sitemap.xml",
      terms: "/terms",
      webmanifest: "/manifest.json",
    },
    name: "Blueprint",
    type: "website",
    url: config.baseUrl,
  };
}

function requireAuthJson(request, response, next) {
  if (!request.session.user || !request.session.accessToken) {
    response.status(401).json({ message: "Authentication required." });
    return;
  }

  next();
}

async function fetchAuthJson(
  endpoint,
  { accessToken, body, correlationId = "", headers: extraHeaders = {}, method = "GET" } = {},
) {
  const headers = { ...extraHeaders };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (correlationId) {
    headers["X-Auth-Correlation-Id"] = correlationId;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const result = await fetch(`${config.authApiBaseUrl}${endpoint}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(config.authRequestTimeoutSeconds * 1000),
  });

  const responseText = await readResponseText(result);
  let payload = {};
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    payload = {};
  }

  if (!result.ok) {
    const error = new Error(payload.message || `Auth request failed with ${result.status}.`);
    error.code = payload.error?.code || mapAuthErrorCode(result.status);
    error.correlationId =
      payload.error?.correlationId ||
      payload.correlationId ||
      result.headers.get("x-auth-correlation-id") ||
      correlationId ||
      "";
    error.statusCode = result.status;
    throw error;
  }

  return payload;
}

async function fetchAuthProfile(accessToken) {
  const correlationId = crypto.randomUUID();
  const payload = await fetchAuthJson("/api/auth/me", { accessToken, correlationId });
  return payload.user || payload;
}

function buildSessionUser(user) {
  const discordProvider = user.oauthProviders?.discord || {};
  const avatarUrl = normalizeText(
    user.profile?.avatar || discordProvider.avatarUrl || "",
    "",
    1000,
  );

  return {
    avatarUrl,
    discordLinked: Boolean(discordProvider.linked && discordProvider.providerUserId),
    discordProviderUsername: normalizeText(discordProvider.username, "", 120),
    discordUserId: normalizeText(discordProvider.providerUserId, "", 160),
    id: normalizeText(user.userId || user.continentalId, "", 80),
    username: normalizeText(user.displayName || user.username, "User", 80),
  };
}

function getAuthClientConfig(request) {
  const trustedLoginOrigins = buildTrustedLoginOrigins(
    config.authLoginPopupUrl,
    config.authTrustedLoginOrigins,
    safeOriginFromUrl,
  );

  return {
    authApiBaseUrl: config.authApiBaseUrl,
    authCompleteUrl: config.authCompleteUrl,
    authLoginPopupUrl: config.authLoginPopupUrl,
    baseUrl: config.baseUrl,
    csrfToken: request.session.csrfToken,
    popupContract: {
      messageSource: AUTH_POPUP_MESSAGE_SOURCE,
      messageType: AUTH_POPUP_MESSAGE_TYPE,
      popupName: AUTH_POPUP_NAME,
    },
    trustedLoginOrigins,
  };
}

async function getManageableGuilds(discordUserId) {
  const results = await Promise.all(
    client.guilds.cache.map(async (guild) => {
      try {
        const member = await guild.members.fetch(discordUserId);
        if (
          !member.permissions.has(PermissionsBitField.Flags.Administrator) &&
          !member.permissions.has(PermissionsBitField.Flags.ManageGuild)
        ) {
          return null;
        }

        const settings = getGuildSettings(guild.id);
        const summary = buildGuildDashboardSummary(settings);

        return {
          attentionCount: summary.attentionCount,
          enabledCount: summary.enabledCount,
          iconUrl: guild.iconURL({ size: 256 }),
          id: guild.id,
          name: guild.name,
          statusLabel: summary.statusLabel,
          statusTone: summary.statusTone,
          updatedAtLabel: summary.updatedAtLabel,
        };
      } catch (error) {
        if (
          error instanceof DiscordAPIError &&
          (error.status === 404 || error.code === 10007)
        ) {
          return null;
        }

        throw error;
      }
    }),
  );

  return results
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function getManagedGuild(discordUserId, guildId) {
  if (!discordUserId) {
    return null;
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return null;
  }

  try {
    const member = await guild.members.fetch(discordUserId);
    if (
      !member.permissions.has(PermissionsBitField.Flags.Administrator) &&
      !member.permissions.has(PermissionsBitField.Flags.ManageGuild)
    ) {
      return null;
    }

    return guild;
  } catch (error) {
    if (
      error instanceof DiscordAPIError &&
      (error.status === 404 || error.code === 10007)
    ) {
      return null;
    }

    throw error;
  }
}

async function getGuildDashboardOptions(guild) {
  await Promise.all([guild.channels.fetch(), guild.roles.fetch()]);
  const botMember = await getBotGuildMember(guild);

  return {
    botMember,
    channelOptions: getTextChannelOptions(guild, botMember),
    mentionRoleOptions: getMentionRoleOptions(guild),
    roleOptions: getAssignableRoleOptions(guild, botMember),
  };
}

let countdownAlertSweepInFlight = false;
let countdownAlertInterval = null;

function startCountdownAlertScheduler() {
  if (countdownAlertInterval) {
    return;
  }

  void runCountdownAlertSweep();

  countdownAlertInterval = setInterval(() => {
    void runCountdownAlertSweep();
  }, 30_000);
}

function stopCountdownAlertScheduler() {
  if (!countdownAlertInterval) {
    return;
  }

  clearInterval(countdownAlertInterval);
  countdownAlertInterval = null;
}

async function runCountdownAlertSweep() {
  if (countdownAlertSweepInFlight) {
    return;
  }

  countdownAlertSweepInFlight = true;

  try {
    const now = new Date();

    for (const guild of client.guilds.cache.values()) {
      try {
        const settings = getGuildSettings(guild.id);
        const lastSentOn = getCountdownAlertLastSentOn(guild.id);

        if (!shouldSendCountdownAlert(settings, now, lastSentOn)) {
          continue;
        }

        await guild.channels.fetch();
        const botMember = await getBotGuildMember(guild);
        const errors = validateCountdownSettings(settings, guild, botMember);
        if (errors.length > 0) {
          continue;
        }

        const channel = guild.channels.cache.get(settings.countdownAlertChannelId);
        if (!channel || !channel.isTextBased()) {
          continue;
        }

        await channel.send(buildCountdownAlertMessage(settings, { now }));
        setCountdownAlertLastSentOn(
          guild.id,
          getCurrentIsoDateInTimeZone(
            now,
            normalizeCountdownAlertTimeZone(settings.countdownAlertTimeZone),
          ),
        );
      } catch (error) {
        logger.error("countdown_alert_failed", { guildId: guild.id }, error);
      }
    }
  } catch (error) {
    logger.error("countdown_alert_sweep_failed", {}, error);
  } finally {
    countdownAlertSweepInFlight = false;
  }
}

async function getBotGuildMember(guild) {
  if (guild.members.me) {
    return guild.members.me;
  }

  return guild.members.fetch(client.user.id);
}

function normalizeColor(value) {
  if (/^#[0-9a-fA-F]{6}$/.test(String(value || ""))) {
    return value;
  }

  return "#5865f2";
}

function normalizeText(value, fallback, maxLength) {
  const trimmed = String(value || "")
    .trim()
    .slice(0, maxLength);

  return trimmed || fallback;
}

function clampDiscordMessage(value, maxLength = 1900) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) {
    return text || "No additional details.";
  }

  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function normalizeToken(value) {
  return normalizeText(value, "", 5000);
}

function normalizeId(value) {
  return /^\d{16,20}$/.test(String(value || "").trim()) ? String(value).trim() : "";
}

function memberCanManageServer(interaction) {
  return Boolean(
    interaction.memberPermissions &&
      (interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator) ||
        interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)),
  );
}

function getSettingsSaveMessage(savedState) {
  if (savedState === "countdown-removed") {
    return "Countdown removed.";
  }

  return savedState ? "Settings updated." : "";
}

function buildGuildDashboardSummary(settings) {
  const modules = evaluateDashboardModules({ settings });
  const enabledCount = modules.filter((module) => module.enabled).length;
  const attentionCount = modules.filter(
    (module) => module.enabled && module.state === "incomplete",
  ).length;

  return {
    attentionCount,
    enabledCount,
    statusLabel:
      attentionCount > 0 ? "Needs attention" : enabledCount > 0 ? "Ready" : "No modules enabled",
    statusTone: attentionCount > 0 ? "incomplete" : enabledCount > 0 ? "live" : "disabled",
    updatedAtLabel: formatUpdatedAtLabel(settings.updatedAt),
  };
}

function buildGuildPageMeta({
  botMember,
  channelOptions,
  guild,
  mentionRoleOptions,
  roleOptions,
  settings,
}) {
  const countdownAlert = getCountdownAlertSummary(settings, channelOptions);
  const modules = evaluateDashboardModules({
    botMember,
    channelOptions,
    guild,
    mentionRoleOptions,
    roleOptions,
    settings,
  });
  const attentionModules = modules.filter((module) => module.enabled && module.blocker).length;
  const enabledModules = modules.filter((module) => module.enabled).length;

  return {
    attentionModules,
    countdownAlertState: countdownAlert.state,
    enabledModules,
    helloEnabled: settings.helloEnabled,
    lastUpdatedLabel: formatUpdatedAtLabel(settings.updatedAt),
    moduleBlockers: Object.fromEntries(
      modules.map((module) => [module.key, module.blocker || ""]),
    ),
    modules,
  };
}

function formatUpdatedAtLabel(value) {
  if (!value) {
    return "Not saved yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently updated";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(date) + " UTC";
}

function safeOriginFromUrl(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function resolveAuthPopupStaticDir() {
  const candidates = [
    path.resolve(process.cwd(), "..", "Dashboard", "frontend", "login"),
    path.resolve(process.cwd(), "..", "Dashboard", "login popup"),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    if (fs.existsSync(path.join(candidate, "popup.html"))) {
      return candidate;
    }
  }

  return "";
}

let discordLoginInFlight = false;
let discordLoginRetryTimer = null;

async function loginDiscordWithRetry() {
  if (discordLoginInFlight || client.isReady()) {
    return;
  }

  discordLoginInFlight = true;
  try {
    await client.login(config.token);
    if (discordLoginRetryTimer) {
      clearTimeout(discordLoginRetryTimer);
      discordLoginRetryTimer = null;
    }
  } catch (error) {
    logger.error("discord_login_failed", {}, error);
    if (!discordLoginRetryTimer) {
      discordLoginRetryTimer = setTimeout(() => {
        discordLoginRetryTimer = null;
        void loginDiscordWithRetry();
      }, DISCORD_LOGIN_RETRY_MS);
    }
  } finally {
    discordLoginInFlight = false;
  }
}

async function start({ host = "127.0.0.1", login = true, port = config.port } = {}) {
  const server = app.listen(port, host, () => {
    logger.info("http_server_started", {
      baseUrl: config.baseUrl,
      port,
      trustProxy: config.trustProxy,
    });
  });

  registerShutdownHandlers(server);
  if (login === true) {
    void loginDiscordWithRetry();
  } else if (typeof login === "function") {
    Promise.resolve()
      .then(login)
      .catch((error) => logger.error("discord_login_failed", {}, error));
  }
  return server;
}

if (require.main === module) {
  start().catch((error) => {
    logger.error("application_start_failed", {}, error);
    process.exit(1);
  });
}

function registerShutdownHandlers(server) {
  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info("shutdown_started", { signal });

    stopCountdownAlertScheduler();
    stopAntiRaidTracking();
    automationCooldowns.clear();
    aiCooldowns.clear();
    if (commandRegistrationRetryTimer) {
      clearTimeout(commandRegistrationRetryTimer);
      commandRegistrationRetryTimer = null;
    }
    if (discordLoginRetryTimer) {
      clearTimeout(discordLoginRetryTimer);
      discordLoginRetryTimer = null;
    }

    await new Promise((resolve) => {
      server.close(resolve);
    });

    client.destroy();
    sessionStore.close();
    process.exit(0);
  }

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
}

module.exports = {
  app,
  client,
  start,
};
