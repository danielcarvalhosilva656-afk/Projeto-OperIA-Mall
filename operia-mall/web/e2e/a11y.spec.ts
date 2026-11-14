import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginByKeyboard } from './helpers';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test('Login sem violações axe (contraste e semântica)', async ({ page }) => {
  await page.goto('/');
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(r.violations, JSON.stringify(r.violations.map(v => v.id))).toEqual([]);
});

for (const [hash, name] of [['dashboard', 'Dashboard'], ['mapa', 'Mapa'], ['triagem', 'Triagem'], ['cadastros', 'Cadastros']]) {
  test(`${name} sem violações axe`, async ({ page }) => {
    await loginByKeyboard(page);
    await page.goto('/#' + hash);
    await page.waitForLoadState('networkidle');
    const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(r.violations, JSON.stringify(r.violations.map(v => v.id))).toEqual([]);
  });
}

test('Drawer de triagem sem violações axe', async ({ page }) => {
  await loginByKeyboard(page);
  await page.goto('/#triagem');
  await page.getByRole('button', { name: /Abrir detalhes de/ }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(r.violations, JSON.stringify(r.violations.map(v => v.id))).toEqual([]);
});
