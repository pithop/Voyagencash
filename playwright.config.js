const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests",
  timeout: 45000,
  expect: { timeout: 7000 },
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    channel: "chromium",
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
  },
  reporter: "list",
});
