import { defineConfig } from "@playwright/test";

// Local e2e harness. Runs against the dev server hitting the live Supabase with
// real staff accounts, so it is NOT wired into CI (would mutate prod). Run with
// `npm run test:e2e`. A hermetic seeded test DB is the proper CI path (next step).
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    // Prod server: routes are prebuilt, so navigation isn't blocked by dev
    // first-compile. Run `npm run build` once before `npm run test:e2e`.
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
