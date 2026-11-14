import { Page } from '@playwright/test';
export async function loginByKeyboard(page: Page) {
  await page.goto('/');
  await page.getByLabel('E-mail ou matrícula').focus();       // primeiro campo
  await page.keyboard.type('admin@operia.mall');
  await page.keyboard.press('Tab');
  await page.keyboard.type(process.env.SEED_PASSWORD || 'operia123');
  await page.keyboard.press('Enter');                          // envia sem mouse
  await page.getByRole('navigation', { name: 'Principal' }).waitFor();
}
