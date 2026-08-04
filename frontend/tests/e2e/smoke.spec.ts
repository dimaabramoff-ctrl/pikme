import { expect, test } from '@playwright/test'

test('home page renders PickMe branding', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'PickMe' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Вокруг меня' }).first()).toBeVisible()
})
