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

## Recommendations

1. **Run QA before merge:** `npm run test:qa` in frontend with MOCK_AUTH dev server.
2. **Keycloak local dev:** Use `sslRequired: none` in realm and `KC_PROXY: edge` (already configured).
