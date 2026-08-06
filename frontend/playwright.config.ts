import { defineConfig, devices } from '@playwright/test'

const frontendPort = process.env.PLAYWRIGHT_FRONTEND_PORT ?? '5176'

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './playwright.global.ts',
  timeout: 30_000,
  retries: 2,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${frontendPort}`,
    actionTimeout: 20_000,
    navigationTimeout: 20_000,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'NODE_ENV=e2e npm --prefix ../backend run start',
      url: 'http://127.0.0.1:3000/api/health',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort} --strictPort`,
      url: `http://127.0.0.1:${frontendPort}`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-background-networking',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
          ],
        },
      },
    },
  ],
})
