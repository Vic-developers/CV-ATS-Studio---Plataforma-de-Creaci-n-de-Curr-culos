import { defineConfig } from "@playwright/test";

const origin = process.env.APP_ORIGIN || "http://localhost:3000";
const services =
  "http://127.0.0.1:" + (process.env.CV_TEST_SERVICES_PORT || "4179");
const smtp = "smtp://127.0.0.1:" + (process.env.CV_TEST_SMTP_PORT || "25251");
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: origin,
    channel: process.env.CV_TEST_BROWSER_CHANNEL || "chromium",
    trace: "retain-on-failure",
  },
  webServer:
    process.env.CV_TEST_EXTERNAL_SERVER === "true"
      ? undefined
      : [
          {
            command: "node tests/e2e/services.mjs",
            url: services + "/health",
            reuseExistingServer: false,
          },
          {
            command: process.env.CV_TEST_SERVER_COMMAND || "npm run dev",
            url: origin,
            reuseExistingServer: false,
            timeout: 120_000,
            env: {
              APP_ORIGIN: origin,
              SMTP_URL: smtp,
              SMTP_FROM: "CV ATS Studio <mail@example.test>",
              AI_BASE_URL: services + "/v1",
              AI_API_KEY: "fixture-key",
              AI_MODEL: "fixture-model",
              LANGUAGE_TOOL_URL: services,
            },
          },
        ],
});
