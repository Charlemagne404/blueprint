"use strict";

const config = require("../src/config");

if (!config.isProduction) {
  console.error("Production configuration check requires NODE_ENV=production.");
  process.exit(1);
}

const result = config.validateRuntimeConfig();

if (result.errors.length > 0) {
  console.error("Production configuration is invalid:");
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

for (const warning of result.warnings) {
  console.warn(`Warning: ${warning}`);
}

console.log("Production configuration shape is valid.");
console.log(`- BASE_URL: ${config.baseUrl}`);
console.log(`- AUTH_API_BASE_URL: ${config.authApiBaseUrl}`);
console.log(`- AUTH_LOGIN_POPUP_URL: ${config.authLoginPopupUrl}`);
console.log(`- AI_SERVER_BASE_URL: ${config.aiServerBaseUrl}`);
