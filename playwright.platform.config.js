import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/platform-e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3102',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    },
  },
  projects: [
    { name: 'platform-desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'platform-mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: 'node scripts/platform-e2e-server.js',
    url: 'http://127.0.0.1:3102/api/health',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
