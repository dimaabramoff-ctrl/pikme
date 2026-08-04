import { expect, test } from '@playwright/test'

test('guest can see nearby catalog from the live app', async ({ page }) => {
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
      body: JSON.stringify([
        {
          id: 'pickme-salon:1',
          source: 'PICKME',
          name: 'PickMe Salon Berlin Mitte',
          address: 'Friedrichstraße 10, Berlin',
          latitude: 52.521,
          longitude: 13.406,
          distanceKm: 0.45,
          rating: 4.9,
          reviewCount: 72,
          openNow: true,
          isPickmeConnected: true,
          isBookable: true,
        },
        {
          id: 'external-google-2',
          source: 'EXTERNAL',
          externalProvider: 'GOOGLE_PLACES',
          externalPlaceId: 'google-2',
          name: 'Friseur Atelier Berlin',
          address: 'Alexanderplatz 2, Berlin',
          latitude: 52.522,
          longitude: 13.41,
          distanceKm: 0.9,
          rating: 4.4,
          reviewCount: 24,
          openNow: false,
          externalUrl: 'https://maps.google.com/?cid=123',
          isPickmeConnected: false,
        },
      ]),
    })
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Салоны рядом с вами' })).toBeVisible()
  await page.getByRole('button', { name: 'Вокруг меня' }).first().click()
  await expect(page.getByRole('heading', { name: 'PickMe Salon Berlin Mitte' }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Friseur Atelier Berlin' }).first()).toBeVisible()
  await expect(page.getByText('★ 4.4 Google').first()).toBeVisible()
  await expect(page.getByLabel('Метка: Friseur Atelier Berlin')).toBeVisible()
  await expect(page.getByText('Подробнее')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Салоны рядом', exact: true })).toBeVisible()
  await expect(page.getByText('Studio Nord')).toHaveCount(0)
  await expect(page.getByText('Beauty & Co')).toHaveCount(0)
})

test('external-only result does not show PickMe availability controls and keeps Google Maps link', async ({ page }) => {
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
      body: JSON.stringify([
        {
          id: 'external-google-100',
          source: 'EXTERNAL',
          externalProvider: 'GOOGLE_PLACES',
          externalPlaceId: 'google-100',
          name: 'Salon Ludwigslust Zentrum',
          address: 'Schloßstraße 17, 19288 Ludwigslust',
          latitude: 53.3241546,
          longitude: 11.4920594,
          distanceKm: 0.79,
          rating: 4.7,
          reviewCount: 94,
          openNow: false,
          externalUrl: 'https://maps.google.com/?cid=12082193944929702958',
          isPickmeConnected: false,
        },
      ]),
    })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Вокруг меня' }).first().click()

  await expect(page.getByRole('heading', { name: 'Salon Ludwigslust Zentrum' }).first()).toBeVisible()
  await expect(page.getByText('★ 4.7 Google').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Подробнее' }).first()).toHaveAttribute('href', /maps\.google\.com/)
  await expect(page.getByText('Онлайн-запись доступна')).toHaveCount(0)
  await expect(page.getByText('Запись сейчас')).toHaveCount(0)
})

test('shows provider unavailable state when nearby API returns 503', async ({ page }) => {
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
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        statusCode: 503,
        code: 'CATALOG_PROVIDER_UNAVAILABLE',
        message: 'Внешний каталог временно недоступен.',
      }),
    })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Вокруг меня' }).first().click()
  await expect(page.getByText('Google Places временно недоступен. Повторите попытку через минуту.')).toBeVisible()
})
