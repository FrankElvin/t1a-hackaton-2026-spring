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

// Mock ImportReceiptResponse for SSE stream
const MOCK_IMPORT_RESPONSE = {
  importedItems: [
    {
      id: 'e2e-imported-1',
      name: 'Milk 2%',
      category: 'BEVERAGES',
      currentQuantity: 2,
      unit: 'L',
      price: 2.99,
    },
    {
      id: 'e2e-imported-2',
      name: 'Whole Wheat Bread',
      category: 'FOOD',
      currentQuantity: 1,
      unit: 'pcs',
      price: 3.49,
    },
  ],
  unrecognizedLines: ['UNKNOWN ITEM XYZ'],
}

/**
 * Helper to create SSE stream response for import endpoints
 */
function createSseStreamResponse(result: object): string {
  const resultData = JSON.stringify(result)
  return `event: progress\ndata: Extracting text...\n\nevent: progress\ndata: AI identified 2 products\n\nevent: result\ndata: ${resultData}\n\n`
}

test.describe('Add Product Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock import APIs so tests run without OCR/LLM (MOCK_AUTH has no backend token)
    await page.route('**/api/v1/items/import/receipt/stream', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: createSseStreamResponse(MOCK_IMPORT_RESPONSE),
        })
      } else {
        await route.continue()
      }
    })
    await page.route('**/api/v1/items/import/email/stream', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: createSseStreamResponse(MOCK_IMPORT_RESPONSE),
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
    test('shows upload area and Scan Receipt button', async ({ page }) => {
      await page.getByRole('tab', { name: /receipt/i }).click()
      await expect(page.getByText(/tap to upload receipt photo/i)).toBeVisible()
      await expect(page.getByText(/JPEG or PNG/)).toBeVisible()
    })

    test('uploads file, runs import, shows success with imported items', async ({
      page,
    }) => {
      await page.getByRole('tab', { name: /receipt/i }).click()

      const receiptPath = path.join(__dirname, 'fixtures', 'receipt-sample.png')
      const fileInput = page.locator('input[type="file"][accept="image/*"]')
      await fileInput.setInputFiles(receiptPath)

      await expect(page.getByAltText(/receipt preview/i)).toBeVisible()
      await page.getByRole('button', { name: /scan receipt/i }).click()

      // Wait for success
      await expect(
        page.getByText(/products imported successfully/, { exact: false })
      ).toBeVisible({ timeout: 15000 })

      await expect(page.getByText('Milk 2%')).toBeVisible()
      await expect(page.getByText('Whole Wheat Bread')).toBeVisible()
      await expect(page.getByText('1 lines skipped')).toBeVisible()

      // Scan Another and Done buttons
      await expect(page.getByRole('button', { name: /scan another/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /^done$/i })).toBeVisible()
    })

    test('Scan Another resets state', async ({ page }) => {
      await page.getByRole('tab', { name: /receipt/i }).click()
      const receiptPath = path.join(__dirname, 'fixtures', 'receipt-sample.png')
      await page.locator('input[type="file"][accept="image/*"]').setInputFiles(receiptPath)
      await page.getByRole('button', { name: /scan receipt/i }).click()
      await expect(page.getByText(/products imported successfully/)).toBeVisible({
        timeout: 15000,
      })

      await page.getByRole('button', { name: /scan another/i }).click()
      await expect(page.getByText(/tap to upload receipt photo/i)).toBeVisible()
    })
  })

  test.describe('Email import', () => {
    test('shows forward address and paste textarea', async ({ page }) => {
      await page.getByRole('tab', { name: /email/i }).click()
      await expect(page.getByText(/forward any store order/i)).toBeVisible()
      await expect(page.getByText('inbox@neverempty.app')).toBeVisible()
      await expect(page.getByPlaceholder(/paste the raw email/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /parse & import/i })).toBeVisible()
    })

    test('copy button exists and is clickable', async ({ page }) => {
      await page.getByRole('tab', { name: /email/i }).click()
      const copyBtn = page.locator('button[title="Copy address"]')
      await expect(copyBtn).toBeVisible()
      await copyBtn.click()
      // Clipboard API may not work in headless; button click is sufficient to verify UX
    })

    test('paste and import shows success', async ({ page }) => {
      await page.getByRole('tab', { name: /email/i }).click()

      const emailPath = path.join(__dirname, 'fixtures', 'sample-order-email.txt')
      const emailContent = await readFile(emailPath, 'utf-8')
      await page.getByPlaceholder(/paste the raw email/i).fill(emailContent)

      await page.getByRole('button', { name: /parse & import/i }).click()

      await expect(
        page.getByText(/products imported successfully/, { exact: false })
      ).toBeVisible({ timeout: 15000 })

      await expect(page.getByText('Milk 2%')).toBeVisible()
      await expect(page.getByRole('button', { name: /import another/i })).toBeVisible()
    })
  })

  test.describe('Barcode', () => {
    test('shows camera or manual entry', async ({ page }) => {
      await page.getByRole('tab', { name: /barcode/i }).click()

      // Either camera UI or "not supported" message
      const hasCamera = await page.getByRole('button', { name: /start camera/i }).isVisible()
      const hasNotSupported = await page
        .getByText(/not supported in this browser/i)
        .isVisible()
      const hasManualEntry = await page.getByPlaceholder(/e\.g\. 4006381333931/i).isVisible()

      expect(hasCamera || hasNotSupported).toBeTruthy()
      expect(hasManualEntry).toBeTruthy()
      await expect(page.getByRole('button', { name: /look up/i })).toBeVisible()
    })

    test('manual barcode lookup pre-fills manual form', async ({ page }) => {
      // Mock Open Food Facts for deterministic test (no external API)
      await page.route('**/api/v2/product/*.json', async (route) => {
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

      // After lookup, switches to manual tab with pre-filled data
      await expect(page.getByRole('tab', { name: /manual/i })).toHaveAttribute(
        'aria-selected',
        'true'
      )
      await expect(page.getByPlaceholder(/e\.g\. Oat Milk/i)).toHaveValue(
        /E2E Test Product|3017620422003/
      )
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

  test('Done button after import navigates to /products', async ({ page }) => {
    await page.getByRole('tab', { name: /receipt/i }).click()
    const receiptPath = path.join(__dirname, 'fixtures', 'receipt-sample.png')
    await page.locator('input[type="file"][accept="image/*"]').setInputFiles(receiptPath)
    await page.getByRole('button', { name: /scan receipt/i }).click()
    await expect(page.getByText(/products imported successfully/)).toBeVisible({
      timeout: 15000,
    })
    await page.getByRole('button', { name: /^done$/i }).click()
    await page.waitForURL(/\/products/, { timeout: 5000 })
    await expect(page).toHaveURL(/\/products/)
  })
})

