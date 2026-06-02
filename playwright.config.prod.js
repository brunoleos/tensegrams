import { defineConfig, devices } from '@playwright/test';

// E2E config pra rodar contra um deploy externo (produção GitHub Pages
// por default; sobreescritível via PLAYWRIGHT_BASE_URL). Não inicia
// http.server — assume URL alcançável.
export default defineConfig({
  testDir: './e2e-prod',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://brunoleos.github.io/tensegrams/',
    // O sandbox em que o agente roda intercepta TLS — sem isso `page.goto`
    // falha com ERR_CERT_AUTHORITY_INVALID antes de chegar no app.
    ignoreHTTPSErrors: true,
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
});
