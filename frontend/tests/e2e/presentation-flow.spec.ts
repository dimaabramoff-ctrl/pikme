import { expect, test, type Page } from '@playwright/test'

async function clickFirstVisibleByRole(page: Page, role: 'button' | 'link', names: RegExp[]) {
  for (const name of names) {
    const target = page.getByRole(role, { name }).first()
    if (await target.count()) {
      try {
        if (await target.isVisible()) {
          if (role === 'button' && !(await target.isEnabled())) {
            continue
          }
          await target.click()
          return true
        }
      } catch {
        continue
      }
    }
  }
  return false
}

async function clickFirstVisibleButton(page: Page, names: RegExp[]) {
  return clickFirstVisibleByRole(page, 'button', names)
}

async function prepareHomeCatalog(page: Page) {
  await clickFirstVisibleButton(page, [/Stadt verwenden/i, /Standort verwenden/i])

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const retryBtn = page.getByRole('button', { name: /Erneut versuchen/i }).first()
    if (!(await retryBtn.count())) {
      return
    }
    await retryBtn.click()
  }
}

async function hasVisibleTimeSlot(page: Page) {
  const firstSlot = page.locator('button:visible').filter({ hasText: /\d{2}:\d{2}/ }).first()
  try {
    await firstSlot.waitFor({ state: 'visible', timeout: 5000 })
    return true
  } catch {
    return false
  }
}

async function pickFirstAvailableSlot(page: Page) {
  const slotButtons = () => page.locator('button:visible').filter({ hasText: /\d{2}:\d{2}/ })

  const clickShowTimes = async () => {
    await clickFirstVisibleButton(page, [
      /Verf(?:ü|u)gbare Zeiten anzeigen/i,
      /Freie Zeiten anzeigen/i,
      /Zeiten anzeigen/i,
      /Показать свободное время/i,
      /Показать время/i,
      /Weiter zu Uhrzeit/i,
    ])
  }

  if (!(await page.getByRole('heading', { name: /Uhrzeit wählen/i }).count())) {
    await clickShowTimes()
  }

  if (await hasVisibleTimeSlot(page)) {
    await slotButtons().first().click()
    return true
  }

  const dateInput = page.getByRole('textbox', { name: /Termindatum|Datum|Дата/i }).first()
  if (!(await dateInput.count())) {
    return false
  }

  for (let dayOffset = 1; dayOffset <= 14; dayOffset += 1) {
    const date = new Date()
    date.setDate(date.getDate() + dayOffset)
    const isoDate = date.toISOString().slice(0, 10)

    await dateInput.fill(isoDate)
    await dateInput.press('Enter')
    await clickShowTimes()

    if (await hasVisibleTimeSlot(page)) {
      await slotButtons().first().click()
      return true
    }
  }

  return false
}

async function clickContinueToTime(page: Page) {
  await clickFirstVisibleButton(page, [/Weiter zu Datum/i, /^Weiter$/i])
  if (await page.getByRole('heading', { name: /Datum wählen/i }).count()) {
    await clickFirstVisibleButton(page, [/Verf(?:ü|u)gbare Zeiten anzeigen/i, /Freie Zeiten anzeigen/i, /Weiter zu Uhrzeit/i, /^Weiter$/i])
    return
  }
  await clickFirstVisibleButton(page, [/Weiter zu Uhrzeit/i, /^Weiter$/i])
}

async function chooseStaffForSlot(page: Page) {
  return clickFirstVisibleButton(page, [
    /Beliebiger verf(?:ü|u)gbarer Mitarbeiter/i,
    /Jeder freie Master/i,
    /Любой мастер/i,
    /\bMila\b/i,
    /\bAnna\b/i,
    /\bDeniz\b/i,
  ])
}

async function chooseAnyServiceForBooking(page: Page) {
  return clickFirstVisibleButton(page, [
    /Hinzufügen/i,
    /Haarschnitt zuhause/i,
    /Styling/i,
    /Nägel/i,
    /Hausbesuch/i,
    /Beratung/i,
    /Herren/i,
    /Damen/i,
    /Kinder/i,
    /Bart/i,
    /Extras/i,
  ])
}

async function waitForMasterDetailState(page: Page, masterName: string): Promise<'ok' | 'unavailable' | 'pending'> {
  const heading = page.getByRole('heading', { name: masterName }).first()
  const unavailable = page.getByText('Salondetails sind derzeit nicht verfügbar.')
  const serviceButton = page
    .locator('button')
    .filter({ hasText: /Haarschnitt zuhause|Styling|Nägel|Hausbesuch|Beratung|Damenhaarschnitt|Herrenhaarschnitt/i })
    .first()

  try {
    await heading.waitFor({ state: 'visible', timeout: 7000 })
  } catch {
    return 'pending'
  }

  if (await unavailable.isVisible().catch(() => false)) {
    return 'unavailable'
  }

  try {
    await serviceButton.waitFor({ state: 'visible', timeout: 7000 })
    return 'ok'
  } catch {
    return 'pending'
  }
}

async function completeBookingAuthGateIfNeeded(page: Page, email: string, password: string) {
  const authHeading = page.getByRole('heading', { name: /Um fortzufahren, melden Sie sich bei PickMe an/i })
  if (!(await authHeading.count())) {
    return
  }

  await page.getByRole('link', { name: /Anmelden/i }).first().click()
  await page.getByLabel(/E-Mail oder Telefon|Email|E-Mail|Email или телефон/i).fill(email)
  await page.getByLabel(/Passwort|Пароль/i).fill(password)
  await page.getByRole('button', { name: /Anmelden|Войти/i }).click()
  await page.getByRole('button', { name: /Termin bestätigen|Buchung bestätigen|Подтвердить запись|Подтвердить заявку/ }).first().click()
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel(/Email|E-Mail|Email или телефон/i).fill(email)
  await page.getByLabel(/Passwort|Пароль/i).fill(password)
  await page.getByRole('button', { name: /Anmelden|Войти/i }).click()
  await expect(page).toHaveURL(/\/profile/)
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Profil/i })).toBeVisible({ timeout: 10000 })
}

async function openSalonFromHome(page: Page, salonName: string) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.goto('/')
    await prepareHomeCatalog(page)
    await clickFirstVisibleButton(page, [/^Salons$/i])

    const salonCard = page.locator('article').filter({ has: page.getByRole('heading', { name: salonName }) }).first()
    if (await salonCard.count()) {
      await expect(salonCard).toBeVisible({ timeout: 15000 })
      await salonCard.getByRole('link', { name: 'Mehr erfahren' }).click()
      return
    }

    const retryBtn = page.getByRole('button', { name: /Erneut versuchen/i }).first()
    if (await retryBtn.count()) {
      await retryBtn.click()
    }
  }

  const salonCard = page.locator('article').filter({ has: page.getByRole('heading', { name: salonName }) }).first()
  await expect(salonCard).toBeVisible({ timeout: 15000 })
  await salonCard.getByRole('link', { name: 'Mehr erfahren' }).click()
}

async function openMasterFromHome(page: Page, masterName: string) {
  const gotoHome = async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15000 })
        return
      } catch (error) {
        if (String(error).includes('ERR_ABORTED')) {
          continue
        }
        throw error
      }
    }
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15000 })
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await gotoHome()
    await prepareHomeCatalog(page)
    await page.getByRole('button', { name: 'Zu Hause' }).click()

    const masterCard = page.locator('article').filter({ hasText: masterName }).first()
    if (await masterCard.count()) {
      await masterCard.waitFor({ state: 'visible', timeout: 10000 })
      await expect(masterCard).toBeVisible({ timeout: 10000 })
      await masterCard.getByRole('link', { name: 'Mehr erfahren' }).click()
      const detailState = await waitForMasterDetailState(page, masterName)
      if (detailState === 'unavailable') {
        await page.goto('/')
        continue
      }
      if (detailState === 'ok') {
        return
      }
    }

    const retryBtn = page.getByRole('button', { name: /Erneut versuchen/i }).first()
    if (await retryBtn.count()) {
      await retryBtn.click()
    }
  }

  const masterCard = page.locator('article').filter({ hasText: masterName }).first()
  await expect(masterCard).toBeVisible({ timeout: 15000 })
  await masterCard.getByRole('link', { name: 'Mehr erfahren' }).click()
  await expect(page.getByRole('heading', { name: masterName })).toBeVisible({ timeout: 10000 })
}

test('demo salon full booking flow with payment and success screen', async ({ page }) => {
  await loginAs(page, 'customer@example.test', 'TestPass123')
  await openSalonFromHome(page, 'PickMe Demo Salon')

  await expect(page.getByRole('heading', { name: 'PickMe Demo Salon' })).toBeVisible()

  await page.getByRole('button', { name: 'Hinzufügen' }).first().click()
  await page.getByRole('button', { name: /Weiter zu Mitarbeiter|Weiter/ }).first().click()
  expect(await chooseStaffForSlot(page)).toBeTruthy()
  await clickContinueToTime(page)

  expect(await pickFirstAvailableSlot(page)).toBeTruthy()

  await page.getByRole('button', { name: /Karte vor Ort|Karte|Оплата картой|Банковская карта/ }).first().click()
  await page.getByRole('button', { name: /Weiter zur Bestätigung|Weiter|Продолжить/ }).first().click()

  await page.getByRole('button', { name: /Termin bestätigen|Buchung bestätigen|Подтвердить запись|Подтвердить заявку/ }).first().click()
  await completeBookingAuthGateIfNeeded(page, 'customer@example.test', 'TestPass123')

  await expect(page.getByText(/Termin ist best[aä]tigt|erfolgreich|успешно/i)).toBeVisible()
  await expect(page.getByText(/PM-2026-/)).toBeVisible()
  await expect(page.getByText('адрес не найден')).toHaveCount(0)
})

test('demo zuhause profile opens and booking wizard is interactive', async ({ page }) => {
  await openMasterFromHome(page, 'PickMe Demo Zuhause')

  await expect(page.getByRole('heading', { name: 'PickMe Demo Zuhause' })).toBeVisible()
  expect(await chooseAnyServiceForBooking(page)).toBeTruthy()
  await clickFirstVisibleButton(page, [/Weiter zu Adresse|Weiter zu Mitarbeiter|Weiter/])
  // address buttons are only shown if the wizard step renders them; skip if absent
  const addressBtn = page.getByRole('button', { name: /Musterstrasse|Schweriner Strasse|Am Schlosspark/ }).first()
  if (await addressBtn.isVisible().catch(() => false)) {
    await addressBtn.click()
    await clickContinueToTime(page)
  }
  expect(await pickFirstAvailableSlot(page)).toBeTruthy()
})

test('stable current profiles are visible from home catalog', async ({ page }) => {
  await page.goto('/')
  await prepareHomeCatalog(page)
  await expect(page.getByRole('heading', { name: 'PickMe Demo Salon' })).toBeVisible()
  // PickMe Testbetrieb is in Berlin — does not appear in Ludwigslust catalog

  await page.getByRole('button', { name: 'Zu Hause' }).click()
  await expect(page.getByRole('heading', { name: 'PickMe Demo Zuhause' }).first()).toBeVisible()

  await expect(page.getByText('Салон не найден')).toHaveCount(0)
  await expect(page.getByText('Мастер не найден')).toHaveCount(0)
})

test('wrong external salon id still renders safe fallback page', async ({ page }) => {
  await page.goto('/salons/external/unknown-external-id')
  await expect(page.getByText('Salon aus dem externen Verzeichnis')).toBeVisible()
  await expect(page.getByText('Dieser Salon ist noch nicht mit PickMe verbunden.')).toBeVisible()
})

test('customer has no salon edit button', async ({ page }) => {
  await loginAs(page, 'customer@example.test', 'TestPass123')
  await openSalonFromHome(page, 'PickMe Demo Salon')

  await expect(page.getByRole('button', { name: /Profil bearbeiten|Demo bearbeiten/ })).toHaveCount(0)
})

test('demo salon owner sees edit button on own salon', async ({ page }) => {
  await loginAs(page, 'demo.salon.owner@example.test', 'TestPass123')
  await openSalonFromHome(page, 'PickMe Demo Salon')

  await expect(page.getByRole('button', { name: /Profil bearbeiten|Demo bearbeiten/ })).toBeVisible()
})

test('owner sees customer phone in own salon orders after confirmed booking', async ({ page }) => {
  await loginAs(page, 'customer@example.test', 'TestPass123')
  await openSalonFromHome(page, 'PickMe Demo Salon')
  await page.getByRole('button', { name: 'Hinzufügen' }).first().click()
  await page.getByRole('button', { name: /Weiter zu Mitarbeiter|Weiter/ }).first().click()
  expect(await chooseStaffForSlot(page)).toBeTruthy()
  await clickContinueToTime(page)
  expect(await pickFirstAvailableSlot(page)).toBeTruthy()
  await page.getByRole('button', { name: /Vor Ort bezahlen|Vor Ort|Оплата в салоне|Оплата при встрече/ }).first().click()
  await page.getByRole('button', { name: /Weiter zur Bestätigung|Weiter|Продолжить/ }).first().click()
  await page.getByRole('button', { name: /Termin bestätigen|Buchung bestätigen|Подтвердить запись|Подтвердить заявку/ }).first().click()
  await completeBookingAuthGateIfNeeded(page, 'customer@example.test', 'TestPass123')

  await loginAs(page, 'demo.salon.owner@example.test', 'TestPass123')
  await openSalonFromHome(page, 'PickMe Demo Salon')

  await expect(page.getByText('Salonbestellungen')).toBeVisible()
  await expect(page.getByText(/\+49000000001|\+49 176 555 01 240/)).toBeVisible()
})

test('owner cannot edit testbetrieb external profile from catalog', async ({ page }) => {
  // Testbetrieb is in Berlin; navigate directly to its URL instead of searching the Ludwigslust catalog
  await loginAs(page, 'demo.salon.owner@example.test', 'TestPass123')
  await page.goto('/salons/external/pickme-testbetrieb-berlin-001')

  await expect(page.getByRole('button', { name: /Profil bearbeiten|Demo bearbeiten/ })).toHaveCount(0)
})
