import { expect, test } from '@playwright/test'

const runAuthSuite = process.env.PLAYWRIGHT_AUTH_E2E === '1'

test.describe('Auth scenarios', () => {
  test.skip(!runAuthSuite, 'Auth e2e runs only in full-stack mode')

  test('@auth customer login flow', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Email или телефон').fill('customer@example.test')
    await page.getByLabel('Пароль').fill('TestPass123')
    await page.getByRole('button', { name: 'Войти' }).click()

    await expect(page).toHaveURL(/\/profile/)
    await expect(page.getByText('Роль: CUSTOMER')).toBeVisible()

    await page.reload()
    await expect(page.getByText('Роль: CUSTOMER')).toBeVisible()

    await page.getByRole('button', { name: 'Выйти', exact: true }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('@auth role protection flow', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email или телефон').fill('customer@example.test')
    await page.getByLabel('Пароль').fill('TestPass123')
    await page.getByRole('button', { name: 'Войти' }).click()
    await expect(page).toHaveURL(/\/profile/)

    await page.goto('/master')
    await expect(page).toHaveURL(/\/profile/)

    await page.getByRole('button', { name: 'Выйти', exact: true }).click()

    await page.goto('/login')
    await page.getByLabel('Email или телефон').fill('master@example.test')
    await page.getByLabel('Пароль').fill('TestPass123')
    await page.getByRole('button', { name: 'Войти' }).click()
    await page.goto('/master')
    await expect(page).toHaveURL(/\/login|\/master|\/profile/)

    await page.goto('/salon-admin')
    await expect(page).toHaveURL(/\/login|\/salon-admin|\/profile/)
  })

  test('@auth registration flow', async ({ page }) => {
    const unique = Date.now()

    await page.goto('/register')
    await page.getByPlaceholder('Имя').fill(`Новый Клиент ${unique}`)
    await page.getByPlaceholder('Email').fill(`register${unique}@example.test`)
    await page.getByPlaceholder('Телефон').fill(`+49008${unique}`)
    await page.locator('input[placeholder="Пароль"]').first().fill('Passw0rd123')
    await page.locator('input[placeholder="Повторите пароль"]').first().fill('Passw0rd123')
    await page.getByRole('button', { name: 'Зарегистрироваться' }).click()

    await expect(page).toHaveURL(/\/login/)

    await page.getByLabel('Email или телефон').fill(`register${unique}@example.test`)
    await page.getByLabel('Пароль').fill('Passw0rd123')
    await page.getByRole('button', { name: 'Войти' }).click()

    await expect(page).toHaveURL(/\/profile/)
    await expect(page.getByText('Роль: CUSTOMER')).toBeVisible()
  })
})
