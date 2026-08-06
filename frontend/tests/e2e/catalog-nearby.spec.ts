import { expect, test } from '@playwright/test'

test('presentation catalog shows stable PickMe salons and external cards', async ({ page }) => {
  await page.goto('/')
  const stadtBtn1 = page.getByRole('button', { name: 'Stadt verwenden' }).first()
  if (await stadtBtn1.isVisible().catch(() => false)) await stadtBtn1.click()

  await expect(page.getByRole('heading', { name: 'PickMe Demo Salon' })).toBeVisible()
  await expect(page.locator('article h3').first()).toBeVisible()

  await expect(page.getByText('PickMe Partner').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Mehr erfahren' }).first()).toBeVisible()

  await expect(page.getByText('Google Places временно недоступен. Повторите попытку.')).toHaveCount(0)
  await expect(page.getByText('адрес не найден')).toHaveCount(0)
})

test('presentation master mode shows stable at-home masters', async ({ page }) => {
  await page.goto('/')
  const stadtBtn2 = page.getByRole('button', { name: 'Stadt verwenden' }).first()
  if (await stadtBtn2.isVisible().catch(() => false)) await stadtBtn2.click()

  await page.getByRole('button', { name: 'Zu Hause' }).click()

  await expect(
  page.getByRole('article')
    .filter({ hasText: 'Selbstständiger Anbieter' })
    .getByRole('heading', { name: 'PickMe Demo Zuhause' })
).toBeVisible()
})

test('invalid external route still opens resilient fallback page', async ({ page }) => {
  await page.goto('/salons/external/invalid-route-id')
  await expect(page.getByText('Salon aus dem externen Verzeichnis')).toBeVisible()
  await expect(page.getByText('Dieser Salon ist noch nicht mit PickMe verbunden.')).toBeVisible()
})
