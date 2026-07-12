import { expect, test } from "@playwright/test";

test("home communicates the testnet product and opens the app", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/MuseLend/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Unlock USDC from your creator token",
  );
  await expect(page.getByText("Base Sepolia", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: /Explore borrowing/i }).click();
  await expect(page).toHaveURL(/\/app\/borrow$/);
});

test("health endpoint is explicit about the disabled mainnet", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  await expect(response.json()).resolves.toMatchObject({
    status: "ok",
    network: "base-sepolia",
    mainnetEnabled: false,
  });
});

test("Italian locale persists and translates critical borrower risks", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Italiano/i }).click();
  await page.goto("/app/borrow");
  await expect(page.locator("html")).toHaveAttribute("lang", "it");
  await expect(page.getByText(/sarà venduto all’apertura/i)).toBeVisible();
});
