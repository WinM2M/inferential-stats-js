import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['e2e/**/*.test.ts'],
    testTimeout: 600000,
    hookTimeout: 600000,
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      instances: [
        {
          browser: 'chromium',
          launch: {
            // Playwright's own Chromium build is used by default so that a
            // contributor (or a reviewer) can run the suite after `npx playwright
            // install chromium`, with no Google Chrome on the machine. Set
            // VITEST_BROWSER_CHANNEL=chrome to test against installed Chrome.
            ...(process.env.VITEST_BROWSER_CHANNEL
              ? { channel: process.env.VITEST_BROWSER_CHANNEL }
              : {}),
            headless: true,
          },
        },
      ],
    },
  },
});
