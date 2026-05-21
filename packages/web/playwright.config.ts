import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:5173',
    channel: process.env.PLAYWRIGHT_USE_SYSTEM_CHROME ? 'chrome' : undefined,
  },
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npm run dev',
        cwd: '../..',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
      },
})
