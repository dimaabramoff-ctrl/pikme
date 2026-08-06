import { expect, test } from '@playwright/test'

test('home page renders PickMe branding', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('link', { name: 'PickMe' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Salons' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zu Hause' })).toBeVisible()
})
