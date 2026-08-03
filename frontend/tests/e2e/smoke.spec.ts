import { expect, test } from '@playwright/test'

test('home page renders PickMe branding', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Пикми' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Найдите салон рядом' })).toBeVisible()
})
