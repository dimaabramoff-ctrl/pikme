import { expect, test } from '@playwright/test'

test('shows a clear message when geolocation permission is denied', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Вокруг меня' }).first().click()
  await expect(page.getByText('Доступ к геолокации запрещен. Включите разрешение в браузере.')).toBeVisible()
})

test('shows a clear message when geolocation is unavailable in browser', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Вокруг меня' }).first().click()
  await expect(page.getByText('Геолокация недоступна на этом устройстве.')).toBeVisible()
})

test('shows timeout message when geolocation request times out', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_success: PositionCallback, error?: PositionErrorCallback) => {
          error?.({
            code: 3,
            message: 'Timeout',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError)
        },
      },
    })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Вокруг меня' }).first().click()
  await expect(page.getByText('Не удалось получить координаты вовремя. Повторите попытку.')).toBeVisible()
})

test('shows empty state when nearby endpoint returns no places', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => {
          success({
            coords: {
              latitude: 52.52,
              longitude: 13.405,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON: () => ({}),
            },
            timestamp: Date.now(),
            toJSON: () => ({}),
          } as GeolocationPosition)
        },
      },
    })
  })

  await page.route('**/api/catalog/nearby**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Вокруг меня' }).first().click()

  await expect(page.getByText('По выбранной локации пока нет подходящих результатов.')).toBeVisible()
})
