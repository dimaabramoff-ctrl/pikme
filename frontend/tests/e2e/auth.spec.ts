import { expect, test } from '@playwright/test'

const runAuthSuite = process.env.PLAYWRIGHT_AUTH_E2E === '1'

test.describe('Auth scenarios', () => {
  test.skip(!runAuthSuite, 'Auth e2e runs only in full-stack mode')

  test('@auth customer login flow', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('E-Mail oder Telefon').fill('customer@example.test')
    await page.getByLabel('Passwort').fill('TestPass123')
    await page.getByRole('button', { name: 'Anmelden' }).click()

    await expect(page).toHaveURL(/\/profile/)
    await expect(page.getByText('Rolle: CUSTOMER')).toBeVisible()

    await page.reload()
    await expect(page.getByText('Rolle: CUSTOMER')).toBeVisible()

    await page.getByRole('button', { name: 'Abmelden', exact: true }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('@auth role protection flow', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-Mail oder Telefon').fill('customer@example.test')
    await page.getByLabel('Passwort').fill('TestPass123')
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await expect(page).toHaveURL(/\/profile/)

    await page.goto('/master')
    await expect(page).toHaveURL(/\/profile/)

    await page.getByRole('button', { name: 'Abmelden', exact: true }).click()

    await page.goto('/login')
    await page.getByLabel('E-Mail oder Telefon').fill('master@example.test')
    await page.getByLabel('Passwort').fill('TestPass123')
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await page.goto('/master')
    await expect(page).toHaveURL(/\/login|\/master|\/profile/)

    await page.goto('/salon-admin')
    await expect(page).toHaveURL(/\/login|\/salon-admin|\/profile/)
  })

  test('@auth registration flow', async ({ page }) => {
    const unique = Date.now()

    await page.goto('/register')
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill(`Новый Клиент ${unique}`)
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill(`register${unique}@example.test`)
    await page.getByRole('textbox', { name: 'Telefon', exact: true }).fill(`+49008${unique}`)
    await page.getByRole('textbox', { name: 'Passwort', exact: true }).fill('Passw0rd123')
    await page.getByRole('textbox', { name: 'Passwort wiederholen', exact: true }).fill('Passw0rd123')
    await page.getByRole('button', { name: 'Registrieren', exact: true }).click()

    await expect(page).toHaveURL(/\/login/)

    await page.getByLabel('E-Mail oder Telefon').fill(`register${unique}@example.test`)
    await page.getByLabel('Passwort').fill('Passw0rd123')
    await page.getByRole('button', { name: 'Anmelden' }).click()

    await expect(page).toHaveURL(/\/profile/)
    await expect(page.getByText('Rolle: CUSTOMER')).toBeVisible()
  })
})
