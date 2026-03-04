# NeverEmpty QA Report

**Date:** 2025-03-04  
**Tester:** Automated QA (Playwright)  
**Test script:** `frontend/e2e/qa-neverempty.spec.ts`

---

## How to Run QA

### Option A: With MOCK_AUTH (recommended for quick checks)

```bash
# Terminal 1: Start dev server with mock auth
cd frontend && VITE_MOCK_AUTH=true npm run dev

# Terminal 2: Run QA tests
cd frontend && QA_BASE_URL=http://localhost:5173 npm run test:qa
```

### Option B: With Docker + Keycloak (full stack)

```bash
# Start full stack
docker-compose up -d

# Run QA
cd frontend && QA_BASE_URL=http://localhost:3000 npm run test:qa
```

---

## TODO List — NeverEmpty QA

### 🔴 Critical (blocks usage)

- [x] **[LOGIN/KEYCLOAK]** Keycloak shows "HTTPS required" when Create account redirects to registration — blocks new user signup in local dev. **Fixed:** Set `sslRequired: "none"` in `keycloak/realm-export.json` and added `KC_PROXY: edge` in docker-compose.yml. For existing Docker setups, run `docker-compose down -v && docker-compose up -d` to re-import the realm.

### 🟡 Major (degrades UX, not blocking)

- [x] **[ADD-PRODUCT]** Vite proxy target was localhost:8080 but Docker backend runs on 8081 — fixed in vite.config.ts. Added `VITE_PROXY_API_TARGET` env var (default 8081). Updated openapi.yaml servers. **Fixed.**

### 🟢 Minor (cosmetic, improvements)

- [x] **[DASHBOARD]** Strict mode in Playwright: multiple elements match "Dashboard" — use `getByRole('heading', { level: 1, name: 'Dashboard' })`. Layout: single h1 instead of duplicate. **Fixed.**
- [x] **[LAYOUT]** Consider adding `role="tab"` to Add Product method buttons for better accessibility. **Fixed:** Added role="tablist", role="tab", role="tabpanel" with proper ARIA.
- [x] **[DASHBOARD/PRODUCTS]** Quantity/unit display — all items showed "1 pcs" regardless of actual quantity/unit (e.g. "Jajka 10szt", "Sok 2l"). **Fixed:** LLM prompts now extract `unit` (L, g, kg, szt, ml, pcs); ImportService uses parsed unit.
- [x] **[ADD-PRODUCT/EMAIL]** Forward email shown in UI (`inbox@neverempty.app`) did not match backend `GMAIL_IMPERSONATE_EMAIL` (.env). **Fixed:** New API `GET /api/v1/settings/forward-email` returns backend email; frontend fetches it. `VITE_FORWARD_EMAIL` fallback for build; add `GMAIL_IMPERSONATE_EMAIL` to `.env` to match.

---

## Test Coverage

| Area | Status (MOCK_AUTH) | Status (Keycloak) |
|------|--------------------|-------------------|
| 1. Login page | ✅ Pass | ✅ Pass |
| 2-3. Registration → Onboarding | ✅ Pass | ✅ Pass (sslRequired: none) |
| 4-5. Onboarding → Dashboard | ✅ Pass | — |
| 6. Dashboard | ✅ Pass | — |
| 7. Products | ✅ Pass | — |
| 8-9. Add Product (4 methods) | ✅ Pass | — |
| 10. Stores | ✅ Pass | — |
| 11. Layout & Logout | ✅ Pass | — |

---

## Add Product E2E Tests (`add-product.e2e.spec.ts`)

Full coverage of `/add-product` page with all 4 methods:

| Test | Description |
|------|-------------|
| Manual entry | Form fields, unit presets, additional details, category/consumer dropdowns |
| Receipt import | Upload file, scan, success screen with quantity+unit (e.g. "2 L", "1 pcs"), Scan Another, Done |
| Email import | Forward address (from API/.env), copy button, paste & import, success screen |
| Barcode | Camera/manual entry, Open Food Facts lookup (mocked) |
| Tab switching | All 4 tabs |
| Done → /products | Navigation after import |

**Run:**
```bash
# Terminal 1
cd frontend && VITE_MOCK_AUTH=true npm run dev

# Terminal 2
cd frontend && npm run test:add-product
```

Uses mocked import APIs (receipt/email) and Open Food Facts to avoid external services. For real DB write verification, run with `docker-compose up -d` and `QA_BASE_URL=http://localhost:3000`.

---

## Recommendations

1. **Run QA before merge:** `npm run test:qa` in frontend with MOCK_AUTH dev server.
2. **Keycloak local dev:** Use `sslRequired: none` in realm and `KC_PROXY: edge` (already configured).
3. **Email import:** Set `GMAIL_IMPERSONATE_EMAIL` in `.env` to the address users should forward emails to. Frontend displays this via `GET /settings/forward-email`. Docker build passes it as `VITE_FORWARD_EMAIL` fallback.
