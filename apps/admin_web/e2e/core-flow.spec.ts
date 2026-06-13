import { test, expect, type Page } from "@playwright/test";

// Core role-flow smoke. Verifies each role's key screens render + the catalog is
// interactive — catches blank pages, broken routes, RLS-empty catalogs, theme
// regressions. Full submit→approve→deliver mutation flow is a follow-up (needs a
// hermetic seeded DB so it can run in CI without touching prod).
const PASSWORD: string = process.env.STAFF_PASSWORD ?? "";
if (!PASSWORD) throw new Error("Set STAFF_PASSWORD env var to run the e2e suite");

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
}

test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("FOH: New Request catalog is populated and interactive", async ({ page }) => {
  await login(page, "foh.shoreditch@bobo.wild");
  await page.goto("/request");
  await expect(page.getByRole("heading", { name: "New Request" })).toBeVisible();
  // Catalog has products (RLS read works) and a row opens the modifier dialog.
  const firstProduct = page.locator("main button", { hasText: /lead/ }).first();
  await expect(firstProduct).toBeVisible();
  await firstProduct.click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("FOH: orders + templates render", async ({ page }) => {
  await login(page, "foh.shoreditch@bobo.wild");
  await page.goto("/orders");
  await expect(page.getByRole("heading", { name: "Order History" })).toBeVisible();
  await page.goto("/templates");
  await expect(page.getByRole("heading", { name: "My Templates" })).toBeVisible();
});

test("Specialist: inbox + board render", async ({ page }) => {
  await login(page, "baker@bobo.wild");
  await page.goto("/inbox");
  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  await page.goto("/board");
  await expect(page.getByRole("heading", { name: "Production Board" })).toBeVisible();
});

test("Courier: manifest renders the route", async ({ page }) => {
  await login(page, "courier@bobo.wild");
  await page.goto("/manifest");
  await expect(page.getByRole("heading", { name: /Route/ })).toBeVisible();
});
