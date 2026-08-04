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
          name: 'PickMe Studio One',
          address: 'Berlin Mitte 10',
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
          id: 'external-fake-2',
          source: 'EXTERNAL',
          externalProvider: 'FAKE',
          externalPlaceId: 'fake-2',
          name: 'External Real Salon',
          address: 'Alexanderplatz 2',
          latitude: 52.522,
          longitude: 13.41,
          distanceKm: 0.9,
          rating: 4.4,
          reviewCount: 24,
          openNow: false,
          externalUrl: 'https://example.test/maps/2',
          isPickmeConnected: false,
        },
      ]),
    })
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Найдите салон рядом' })).toBeVisible()
  await page.getByRole('button', { name: 'Вокруг меня' }).first().click()
  await expect(page.getByRole('heading', { name: 'PickMe Studio One' }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'External Real Salon' }).first()).toBeVisible()
  await expect(page.getByText('Открыть на карте')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Салоны рядом' })).toBeVisible()
})
