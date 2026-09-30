import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("celular: barra inferior, pagamento em destaque, filtros recolhidos e menu Mais", async ({ page }) => {
  await login(page);
  await expect(page.locator(".tabbar")).toBeVisible();
  await expect(page.locator(".btn--block", { hasText: "Registrar pagamento" })).toBeVisible();
  await page.goto("/mensalidades");
  await expect(page.locator(".filters-more")).toBeHidden();
  await page.click(".filters-toggle");
  await expect(page.locator(".filters-more")).toBeVisible();
  await page.locator(".tabbar button", { hasText: "Mais" }).click();
  await expect(page.locator(".sidebar.is-open")).toBeVisible();
  await page.locator(".sidebar a", { hasText: "Configurações" }).click();
  await expect(page).toHaveURL(/configuracoes/);
});
