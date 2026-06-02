import { defineConfig, devices } from '@playwright/test';

// E2E config — Chromium only (target requirement). The SPA is served by
// Python http.server (zero deps) so we just wire a webServer that boots it.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,    // localStorage per-context is isolated, but we keep
                           // tests sequential for deterministic golden snapshots
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line']] : [['list']],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://127.0.0.1:5179',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'python3 -m http.server 5179 --bind 127.0.0.1',
    url: 'http://127.0.0.1:5179',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
