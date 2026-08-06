import { expect, test } from '@playwright/test'

test('presentation home does not depend on geolocation success', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_success: PositionCallback, error?: PositionErrorCallback) => {
          error?.({
            code: 1,
            message: 'Permission denied',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError)
        },
      },
    })
  })

  await page.goto('/')

  // In presentation mode the location is preset; geolocation errors are not shown
  const stadtBtnGeo1 = page.getByRole('button', { name: 'Stadt verwenden' }).first()
  if (await stadtBtnGeo1.isVisible().catch(() => false)) await stadtBtnGeo1.click()

  await expect(page.getByRole('heading', { name: 'PickMe Demo Salon' })).toBeVisible()
  await expect(page.locator('article h3').first()).toBeVisible()
  await expect(page.getByText('адрес не найден')).toHaveCount(0)
})

test('presentation home remains stable when geolocation API is missing', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    })
  })

  await page.goto('/')

  await expect(page.getByText('Standortbestimmung wird vorbereitet.')).toHaveCount(0)
  const stadtBtnGeo2 = page.getByRole('button', { name: 'Stadt verwenden' }).first()
  if (await stadtBtnGeo2.isVisible().catch(() => false)) await stadtBtnGeo2.click()

  await expect(page.getByRole('heading', { name: 'PickMe Demo Salon' })).toBeVisible()
  await expect(page.locator('article h3').first()).toBeVisible()
  await expect(page.getByText('адрес не найден')).toHaveCount(0)
})
