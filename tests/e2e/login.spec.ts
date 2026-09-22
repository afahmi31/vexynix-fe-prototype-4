import { test, expect } from "@playwright/test";

/**
 * Auth flow E2E tests with MSW fixtures.
 *
 * Login and register are now modals (not separate pages). /login and
 * /register are deep-link shims that redirect to /lobby and open the matching
 * modal. Selectors target #login-* / #register-* ids (scoped to the dialog)
 * because the lobby has its own search input that would collide with generic
 * input selectors.
 */

const loginDialog = (page: import("@playwright/test").Page) =>
  page.getByRole("dialog", { name: "Masuk" });
const registerDialog = (page: import("@playwright/test").Page) =>
  page.getByRole("dialog", { name: "Daftar" });

test.describe("Login Flow (modal)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.waitForURL("/lobby", { timeout: 10000 });
    await expect(loginDialog(page)).toBeVisible();
  });

  test("opens login modal via /login deep-link", async ({ page }) => {
    await expect(page).toHaveURL("/lobby");
    await expect(page.locator("#login-identifier")).toBeVisible();
    await expect(page.locator("#login-password")).toBeVisible();
    await expect(
      loginDialog(page).locator("button[type=submit]")
    ).toBeVisible();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.locator("#login-identifier").fill("wronguser");
    await page.locator("#login-password").fill("wrongpassword");
    await loginDialog(page).locator("button[type=submit]").click();

    await expect(page.locator("text=/kredensial tidak valid/i")).toBeVisible({
      timeout: 5000,
    });
  });

  test("logs in and closes the modal", async ({ page }) => {
    await page.locator("#login-identifier").fill("testplayer");
    await page.locator("#login-password").fill("password123");
    await loginDialog(page).locator("button[type=submit]").click();

    // Modal closes...
    await expect(loginDialog(page)).toBeHidden({ timeout: 10000 });
    // ...and the header switches to the logged-in state (Deposit button).
    await expect(
      page.locator(".portal-header-deposit-btn", { hasText: "Deposit" })
    ).toBeVisible();
  });

  test("has accessible form labels", async ({ page }) => {
    await expect(page.getByLabel("Username atau No. HP")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("supports keyboard navigation between fields", async ({ page }) => {
    await page.locator("#login-identifier").focus();
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => document.activeElement?.id)
    ).toBe("login-password");

    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => document.activeElement?.tagName)
    ).toBe("BUTTON");
  });
});

test.describe("Login Form Validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.waitForURL("/lobby", { timeout: 10000 });
    await expect(loginDialog(page)).toBeVisible();
  });

  test("requires identifier", async ({ page }) => {
    await page.locator("#login-password").fill("password123");
    await loginDialog(page).locator("button[type=submit]").click();

    await expect(page.locator("text=/wajib diisi/i").first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("requires password", async ({ page }) => {
    await page.locator("#login-identifier").fill("testplayer");
    await loginDialog(page).locator("button[type=submit]").click();

    await expect(page.locator("text=/wajib diisi/i").first()).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe("Register Flow (modal)", () => {
  test("opens register modal via /register deep-link", async ({ page }) => {
    await page.goto("/register");
    await page.waitForURL("/lobby", { timeout: 10000 });
    await expect(registerDialog(page)).toBeVisible();
    await expect(page.locator("#register-username")).toBeVisible();
  });

  test("opens register modal from the header Daftar button", async ({
    page,
  }) => {
    await page.goto("/lobby");
    await page
      .locator(".portal-header-deposit-btn", { hasText: "Daftar" })
      .click();
    await expect(registerDialog(page)).toBeVisible();
  });

  test("register success switches to the login modal with banner", async ({
    page,
  }) => {
    await page.goto("/register");
    await page.waitForURL("/lobby", { timeout: 10000 });

    await page.locator("#register-username").fill("newuser1");
    await page.locator("#register-phone").fill("08123456789");
    await page.locator("#register-password").fill("password123");
    await page.locator("#register-confirm").fill("password123");
    await registerDialog(page).locator("button[type=submit]").click();

    // Switches to login modal...
    await expect(loginDialog(page)).toBeVisible({ timeout: 10000 });
    // ...and shows the "account created" banner.
    await expect(page.locator("text=/akun berhasil dibuat/i")).toBeVisible();
  });
});
