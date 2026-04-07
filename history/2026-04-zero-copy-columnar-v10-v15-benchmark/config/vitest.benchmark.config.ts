import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['e2e/inferential-stats.benchmark.test.ts'],
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
            channel: 'chrome',
            headless: true,
          },
        } as any,
      ],
    },
  },
});
