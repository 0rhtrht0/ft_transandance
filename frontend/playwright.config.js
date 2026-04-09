import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
