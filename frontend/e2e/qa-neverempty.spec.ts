/**
 * NeverEmpty QA Test Suite
 * Follows .cursor/skills/neverempty-qa/SKILL.md testing order
 * Single flow to preserve auth session across steps
 */
import { test, expect } from '@playwright/test'

const BASE = process.env.QA_BASE_URL || 'http://localhost:3000'
const TEST_EMAIL = `qa-${Date.now()}@test.com`
const TEST_PASSWORD = 'Test1234!'

test('NeverEmpty QA - Full flow', async ({ page }) => {
  const issues: { severity: string; area: string; msg: string }[] = []

  const report = (severity: string, area: string, msg: string) => {
    issues.push({ severity, area, msg })
    console.log(`[${severity}] [${area}] ${msg}`)
  }

  // Capture console errors
  page.on('console', (msg) => {
    const text = msg.text()
    if (text.includes('Error') || text.includes('CORS') || text.includes('401') || text.includes('403')) {
      report('Critical', 'CONSOLE', `Console: ${text}`)
    }
  })

  // 1. Login page
  await test.step('1. Login page loads', async () => {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /log in/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible()
  })

  // 2–3. Registration
  await test.step('2-3. Registration to onboarding', async () => {
    await page.getByRole('button', { name: /create account/i }).click()

    // Wait for either MOCK_AUTH (-> /onboarding) or Keycloak redirect
    await Promise.race([
      page.waitForURL(/\/onboarding/, { timeout: 5000 }),
      page.waitForURL(/localhost:9090|realms/, { timeout: 5000 }),
    ]).catch(() => {
      report('Critical', 'LOGIN', 'Create account did not redirect')
    })

    if (page.url().includes('/onboarding')) return // MOCK_AUTH - done

    const username = page.locator('#username').first()
    const email = page.locator('#email').first()
    const firstName = page.locator('#firstName').first()
    const lastName = page.locator('#lastName').first()
    const password = page.locator('#password').first()

    if (await username.isVisible()) await username.fill(TEST_EMAIL)
    if (await email.isVisible()) await email.fill(TEST_EMAIL)
    if (await firstName.isVisible()) await firstName.fill('QA')
    if (await lastName.isVisible()) await lastName.fill('Tester')
    if (await password.isVisible()) await password.fill(TEST_PASSWORD)

    const passwordConfirm = page.locator('#password-confirm').first()
    if (await passwordConfirm.isVisible()) await passwordConfirm.fill(TEST_PASSWORD)

    await page.getByRole('button', { name: /register|create|sign up/i }).click()
    await page.waitForURL(/\/onboarding/, { timeout: 15000 }).catch(() => {
      report('Critical', 'REGISTRATION', 'Did not redirect to /onboarding after registration')
    })
  })

  // 4–5. Onboarding
  await test.step('4-5. Onboarding to dashboard', async () => {
    if (page.url().includes('/login')) {
      report('Critical', 'ONBOARDING', 'Redirected to login instead of onboarding')
      return
    }
    await expect(page.getByRole('heading', { name: /set up your household/i })).toBeVisible({ timeout: 5000 })

    const addStoreBtn = page.getByRole('button', { name: /add store|add a store/i })
    if (await addStoreBtn.isVisible()) {
      await addStoreBtn.click()
      const storeName = page.getByPlaceholder(/store name|name/i).first()
      if (await storeName.isVisible()) {
        await storeName.fill('QA Test Store')
        await page.getByRole('button', { name: /add|save/i }).first().click()
      }
    }

    await page.getByRole('button', { name: /complete|finish|continue/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 10000 }).catch(() => {
      report('Critical', 'ONBOARDING', 'Did not redirect to /dashboard after completion')
    })
  })

  // 6. Dashboard
  await test.step('6. Dashboard', async () => {
    if (page.url().includes('/login')) {
      report('Major', 'DASHBOARD', 'Redirected to login when accessing dashboard')
      return
    }
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible({ timeout: 5000 })
  })

  // 7. Products
  await test.step('7. Products', async () => {
    await page.getByRole('link', { name: 'Products' }).click()
    await page.waitForURL(/\/products/, { timeout: 5000 })
    await expect(page.locator('h1').filter({ hasText: 'Products' }).first()).toBeVisible({ timeout: 5000 })
  })

  // 8–9. Add Product
  await test.step('8-9. Add Product', async () => {
    await page.getByRole('link', { name: 'Add Product' }).first().click()
    await page.waitForURL(/\/add-product/, { timeout: 5000 })
    await expect(page.locator('h1').filter({ hasText: 'Add Product' }).first()).toBeVisible({ timeout: 3000 })

    // Method buttons (Manual, Receipt, Email, Barcode) - use tab role for accessibility
    await expect(page.getByRole('tab', { name: /manual/i })).toBeVisible({ timeout: 3000 })

    const nameInput = page.getByPlaceholder(/name|product name/i).first()
    if (await nameInput.isVisible()) await nameInput.fill('QA Test Product')
  })

  // 10. Stores
  await test.step('10. Stores', async () => {
    await page.getByRole('link', { name: 'Stores' }).click()
    await page.waitForURL(/\/stores/, { timeout: 5000 })
    await expect(page.locator('h1').filter({ hasText: 'Stores' }).first()).toBeVisible({ timeout: 5000 })
  })

  // 11. Layout
  await test.step('11. Layout & Logout', async () => {
    await page.getByRole('link', { name: 'Dashboard' }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 5000 })
    const signOutBtn = page.getByRole('button', { name: /sign out/i })
    if (!(await signOutBtn.isVisible())) report('Minor', 'LAYOUT', 'Sign out button not visible')
  })

  if (issues.length > 0) {
    throw new Error(`QA found ${issues.length} issue(s). See report above.`)
  }
})
