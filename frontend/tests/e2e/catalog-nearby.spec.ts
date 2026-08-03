import { expect, test } from '@playwright/test'

test('guest can see nearby catalog from the live app', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Найдите салон рядом' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Вокруг меня' }).first()).toBeVisible()
  await page.getByPlaceholder('Поиск салона, услуги или мастера').fill('Berlin')
  await expect(page.getByRole('heading', { name: 'Салоны рядом' })).toBeVisible()
})
