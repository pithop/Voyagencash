const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests",
  timeout: 45000,
  expect: { timeout: 7000 },
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:4174",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    channel: "chromium",
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: "node scripts/serve.mjs",
    env: { PORT: "4174", VOYAGENCASH_TEST_MODE: "true", DUFFEL_API_TOKEN: "", LIVE_CHECKOUT_ENABLED: "false", PAYENCASH_API_KEY: "", PAYENCASH_ADAPTER_URL: "", PAYENCASH_WEBHOOK_SECRET: "" },
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
  },
  reporter: "list",
});
