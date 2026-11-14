import { test, expect } from '@playwright/test';
import { loginByKeyboard } from './helpers';

test('Fluxo de triagem completo usando somente o teclado', async ({ page }) => {
  await loginByKeyboard(page);

  // "Ir para o conteudo" aparece como primeiro foco
  await page.goto('/#triagem');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Ir para o conteúdo principal' })).toBeFocused();

  // Foco visivel (outline) em controle focado
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(outline).not.toBe('none');

  // Abre a ocorrencia com Enter, ajusta prioridade e fecha com Esc
  const first = page.getByRole('button', { name: /Abrir detalhes de/ }).first();
  await first.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const inside = await page.evaluate(() => !!document.activeElement?.closest('dialog'));
  expect(inside).toBe(true);                                   // foco preso no modal

  await dialog.getByLabel('Prioridade').selectOption('ALTA');
  await dialog.getByLabel('Justificativa').first().fill('Teste de acessibilidade por teclado');
  await dialog.getByLabel('Justificativa').first().press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'Prioridade atualizada.' }).first()).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('Abas de cadastros navegam por setas', async ({ page }) => {
  await loginByKeyboard(page);
  await page.goto('/#cadastros');
  await page.getByRole('tab', { name: 'Usuários' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Equipes' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Categorias' })).toBeFocused();
});

test('Marcador do mapa é acionável por teclado', async ({ page }) => {
  await loginByKeyboard(page);
  await page.goto('/#mapa');
  const m = page.locator('g.marker').first();
  if (await m.count()) { await m.focus(); await page.keyboard.press('Enter'); await expect(page.getByRole('button', { name: /Limpar setor/ })).toBeVisible(); }
});
