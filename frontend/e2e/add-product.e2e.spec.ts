/**
 * E2E tests for Add Product page (/add-product)
 * Covers all 4 methods: Manual, Receipt, Email, Barcode
 *
 * Run with MOCK_AUTH (recommended):
 *   VITE_MOCK_AUTH=true npm run dev  (Terminal 1)
 *   QA_BASE_URL=http://localhost:5173 npm run test:add-product  (Terminal 2)
 *
 * Run with full stack (Docker + Keycloak):
 *   docker-compose up -d
 *   QA_BASE_URL=http://localhost:3000 npm run test:add-product
 */
import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import { readFile } from 'fs/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = process.env.QA_BASE_URL || 'http://localhost:5173'

test.describe('Add Product Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock import APIs so tests run without OCR/LLM (MOCK_AUTH has no backend token)
    // Parse endpoints return ImportBatchResponse (products to review)
    const MOCK_BATCH_RESPONSE = {
      id: 'e2e-batch-1',
      source: 'RECEIPT',
      parsedProducts: [
        { index: 1, name: 'Milk 2%', quantity: 2, unit: 'L', category: 'BEVERAGES' },
        { index: 2, name: 'Whole Wheat Bread', quantity: 1, unit: 'pcs', category: 'FOOD' },
      ],
      unrecognizedLines: ['UNKNOWN ITEM XYZ'],
      createdAt: new Date().toISOString(),
    }
    const createParseSseResponse = (result: object) =>
      `event: progress\ndata: Parsing...\n\nevent: progress\ndata: Import batch ready\n\nevent: result\ndata: ${JSON.stringify(result)}\n\n`

    await page.route('**/api/v1/items/import/receipt/parse/stream', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: createParseSseResponse(MOCK_BATCH_RESPONSE),
        })
      } else {
        await route.continue()
      }
    })
    await page.route('**/api/v1/items/import/email/parse/stream', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: createParseSseResponse({ ...MOCK_BATCH_RESPONSE, source: 'EMAIL' }),
        })
      } else {
        await route.continue()
      }
    })

    // Navigate via login with MOCK_AUTH (Create account -> onboarding -> dashboard)
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /create account/i }).click()
    await page.waitForURL(/\/onboarding|\/dashboard/, { timeout: 8000 }).catch(() => {})

    if (page.url().includes('/onboarding')) {
      const addStoreBtn = page.getByRole('button', { name: /add store|add a store/i })
      if (await addStoreBtn.isVisible()) {
        await addStoreBtn.click()
        const storeName = page.getByPlaceholder(/store name|name/i).first()
        if (await storeName.isVisible()) {
          await storeName.fill('E2E Test Store')
          await page.getByRole('button', { name: /add|save/i }).first().click()
        }
      }
      await page.getByRole('button', { name: /complete|finish|continue/i }).click()
      await page.waitForURL(/\/dashboard/, { timeout: 10000 })
    }

    await page.getByRole('link', { name: 'Add Product' }).first().click()
    await page.waitForURL(/\/add-product/, { timeout: 5000 })
  })

  test('page loads with all 4 method tabs visible', async ({ page }) => {
    await expect(page.locator('h1').filter({ hasText: 'Add Product' })).toBeVisible()
    await expect(page.getByRole('tab', { name: /manual/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /receipt/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /email/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /barcode/i })).toBeVisible()
  })

  test.describe('Manual entry', () => {
    test('shows required fields and unit presets', async ({ page }) => {
      await expect(page.getByRole('tab', { name: /manual/i })).toBeVisible()
      await expect(page.getByLabel(/name/i)).toBeVisible()
      await expect(page.getByLabel(/quantity/i)).toBeVisible()
      await expect(page.getByLabel(/unit/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /save product/i })).toBeVisible()

      // Unit presets (use exact to avoid L matching ml/roll)
      for (const unit of ['pcs', 'kg', 'L', 'ml']) {
        await expect(page.getByRole('button', { name: unit, exact: true })).toBeVisible()
      }
    })

    test('can fill form and submit (navigates to /products)', async ({ page }) => {
      await page.getByPlaceholder(/e\.g\. Oat Milk/i).fill('E2E Test Milk')
      await page.getByLabel(/quantity/i).fill('3')
      await page.getByRole('button', { name: 'L', exact: true }).click()

      await page.getByRole('button', { name: /save product/i }).click()
      await page.waitForURL(/\/products/, { timeout: 5000 })
      await expect(page).toHaveURL(/\/products/)
    })

    test('additional details section expands', async ({ page }) => {
      await page.getByRole('button', { name: /additional details/i }).click()
      await expect(page.getByLabel(/store/i)).toBeVisible()
      await expect(page.getByLabel(/category/i)).toBeVisible()
      await expect(page.getByLabel(/consumed by/i)).toBeVisible()
      await expect(page.getByLabel(/price/i)).toBeVisible()
      await expect(page.getByLabel(/monthly usage/i)).toBeVisible()
    })

    test('category and consumer dropdowns have options', async ({ page }) => {
      await page.getByRole('button', { name: /additional details/i }).click()
      await page.getByLabel(/category/i).selectOption('FOOD')
      await page.getByLabel(/consumed by/i).selectOption('ADULT')
      await expect(page.getByLabel(/category/i)).toHaveValue('FOOD')
      await expect(page.getByLabel(/consumed by/i)).toHaveValue('ADULT')
    })
  })

  test.describe('Receipt import', () => {
    test('shows upload area and Parse & Review button', async ({ page }) => {
      await page.getByRole('tab', { name: /receipt/i }).click()
      await expect(page.getByText(/tap to upload receipt photo/i)).toBeVisible()
      await expect(page.getByText(/JPEG or PNG/)).toBeVisible()
    })

    test('uploads file, parses, shows review form with first product', async ({
      page,
    }) => {
      await page.getByRole('tab', { name: /receipt/i }).click()

      const receiptPath = path.join(__dirname, 'fixtures', 'receipt-sample.png')
      const fileInput = page.locator('input[type="file"][accept="image/*"]')
      await fileInput.setInputFiles(receiptPath)

      await expect(page.getByAltText(/receipt preview/i)).toBeVisible()
      await page.getByRole('button', { name: /parse & review/i }).click()

      // Wait for review flow
      await expect(
        page.getByText(/review each product/i)
      ).toBeVisible({ timeout: 15000 })

      // First shows choose: link to existing or create new
      await expect(page.getByText(/review each product/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /create new/i })).toBeVisible()
      await page.getByRole('button', { name: /create new/i }).click()
      // Full form with name autocomplete
      await expect(page.locator('input#review-name')).toHaveValue(/.+/)
      await expect(page.getByRole('button', { name: /save & next/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /skip/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /^done$/i })).toBeVisible()
    })

    test('Back from review returns to upload', async ({ page }) => {
      await page.getByRole('tab', { name: /receipt/i }).click()
      const receiptPath = path.join(__dirname, 'fixtures', 'receipt-sample.png')
      await page.locator('input[type="file"][accept="image/*"]').setInputFiles(receiptPath)
      await page.getByRole('button', { name: /parse & review/i }).click()
      await expect(page.getByText(/review each product/i)).toBeVisible({
        timeout: 15000,
      })

      await page.getByTestId('review-back').click()
      await expect(page.getByText(/tap to upload receipt photo/i)).toBeVisible()
    })
  })

  test.describe('Email import', () => {
    test('shows forward address and paste textarea', async ({ page }) => {
      await page.getByRole('tab', { name: /email/i }).click()
      await expect(page.getByText(/forward any store order/i)).toBeVisible()
      // Forward email comes from API (GMAIL_IMPERSONATE_EMAIL) or fallback
      await expect(page.locator('code').filter({ hasText: /@/ })).toBeVisible()
      await expect(page.getByPlaceholder(/paste the raw email/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /parse & review/i })).toBeVisible()
    })

    test('copy button exists and is clickable', async ({ page }) => {
      await page.getByRole('tab', { name: /email/i }).click()
      const copyBtn = page.locator('button[title="Copy address"]')
      await expect(copyBtn).toBeVisible()
      await copyBtn.click()
      // Clipboard API may not work in headless; button click is sufficient to verify UX
    })

    test('paste and parse shows review form', async ({ page }) => {
      await page.getByRole('tab', { name: /email/i }).click()

      const emailPath = path.join(__dirname, 'fixtures', 'sample-order-email.txt')
      const emailContent = await readFile(emailPath, 'utf-8')
      await page.getByPlaceholder(/paste the raw email/i).fill(emailContent)

      await page.getByRole('button', { name: /parse & review/i }).click()

      await expect(page.getByText(/review each product/i)).toBeVisible({
        timeout: 15000,
      })
      await page.getByRole('button', { name: /create new/i }).click()
      await expect(page.locator('input#review-name')).toHaveValue(/.+/)
      await expect(page.getByRole('button', { name: /save & next/i })).toBeVisible()
    })
  })

  test.describe('Barcode', () => {
    test('shows camera or manual entry', async ({ page }) => {
      await page.getByRole('tab', { name: /barcode/i }).click()

      // html5-qrcode works on all browsers — camera button is always shown
      await expect(page.getByRole('button', { name: /start camera/i })).toBeVisible()
      await expect(page.getByPlaceholder(/e\.g\. 4006381333931/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /look up/i })).toBeVisible()
    })

    test('manual barcode lookup shows review form (same as receipt/email)', async ({ page }) => {
      await page.route('**/openfoodfacts.org/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 1,
            product: {
              product_name: 'E2E Test Product',
              quantity: '500g',
            },
          }),
        })
      })

      await page.getByRole('tab', { name: /barcode/i }).click()
      await page.getByPlaceholder(/e\.g\. 4006381333931/i).fill('3017620422003')
      await page.getByRole('button', { name: /look up/i }).click()

      await expect(page.getByText(/review each product/i)).toBeVisible({ timeout: 5000 })
      await expect(page.getByText(/E2E Test Product/)).toBeVisible()
      await expect(
        page.getByRole('button', { name: /create new|save & next|skip|done/i })
      ).toBeVisible()
    })
  })

  test('tab switching works', async ({ page }) => {
    for (const tab of ['receipt', 'email', 'barcode', 'manual']) {
      await page.getByRole('tab', { name: new RegExp(tab, 'i') }).click()
      await expect(
        page.getByRole('tab', { name: new RegExp(tab, 'i') })
      ).toHaveAttribute('aria-selected', 'true')
    }
  })

  test('Done button after parse navigates to /products', async ({ page }) => {
    await page.getByRole('tab', { name: /receipt/i }).click()
    const receiptPath = path.join(__dirname, 'fixtures', 'receipt-sample.png')
    await page.locator('input[type="file"][accept="image/*"]').setInputFiles(receiptPath)
    await page.getByRole('button', { name: /parse & review/i }).click()
    await expect(page.getByText(/review each product/i)).toBeVisible({
      timeout: 15000,
    })
    await page.getByRole('button', { name: /create new/i }).click()
    await page.getByRole('button', { name: /^done$/i }).click()
    await page.waitForURL(/\/products/, { timeout: 5000 })
    await expect(page).toHaveURL(/\/products/)
  })
})

