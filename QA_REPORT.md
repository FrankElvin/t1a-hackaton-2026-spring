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

# Run QA (will fail at registration due to Keycloak HTTPS issue)
cd frontend && QA_BASE_URL=http://localhost:3000 npm run test:qa
```

---

## TODO List — NeverEmpty QA

### 🔴 Critical (blocks usage)

- [x] **[LOGIN/KEYCLOAK]** Keycloak shows "HTTPS required" when Create account redirects to registration — blocks new user signup in local dev. **Fixed:** Set `sslRequired: "none"` in `keycloak/realm-export.json` and added `KC_PROXY: edge` in docker-compose.yml. For existing Docker setups, run `docker-compose down -v && docker-compose up -d` to re-import the realm.

### 🟡 Major (degrades UX, not blocking)

- [ ] **[ADD-PRODUCT]** Vite proxy target was localhost:8080 but Docker backend runs on 8081 — fixed in vite.config.ts for dev server. **Verify** other envs use correct port.

### 🟢 Minor (cosmetic, improvements)

- [ ] **[DASHBOARD]** Strict mode in Playwright: multiple elements match "Dashboard" — use specific locators (getByRole heading) in tests.
- [ ] **[LAYOUT]** Consider adding `role="tab"` to Add Product method buttons for better accessibility.

---

## Test Coverage

| Area | Status (MOCK_AUTH) | Status (Keycloak) |
|------|--------------------|-------------------|
| 1. Login page | ✅ Pass | ✅ Pass |
| 2-3. Registration → Onboarding | ✅ Pass | ❌ Keycloak HTTPS |
| 4-5. Onboarding → Dashboard | ✅ Pass | — |
| 6. Dashboard | ✅ Pass | — |
| 7. Products | ✅ Pass | — |
| 8-9. Add Product (4 methods) | ✅ Pass | — |
| 10. Stores | ✅ Pass | — |
| 11. Layout & Logout | ✅ Pass | — |

---

## Recommendations

1. **Keycloak HTTPS:** Configure KC_HOSTNAME_STRICT or disable HTTPS requirement for local development (see Keycloak docs).
2. **Run QA before merge:** `npm run test:qa` in frontend with MOCK_AUTH dev server.
3. **Pass this TODO list to Claude Code** for fixing the critical Keycloak issue.
