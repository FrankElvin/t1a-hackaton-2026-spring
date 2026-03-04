# REQ-01: Authentication

## Overview
User must authenticate before accessing the app. JWT-based auth with email + password.

## Screens

### Login Screen
- Fields: email, password
- Actions: "Log in" button, "Register" link
- On success: redirect to Dashboard (if household exists) or Onboarding (if new user)
- On failure: inline error message

### Register Screen
- Fields: email, password, confirm password
- Actions: "Create account" button, "Already have an account?" link
- On success: issue JWT, redirect to Onboarding questionnaire
- Validation: email format, password min 8 chars

## JWT Details
- Access token: short-lived (e.g. 15 min)
- Refresh token: long-lived (e.g. 7 days), stored in httpOnly cookie
- All API requests include `Authorization: Bearer <token>` header
- On 401: attempt silent refresh, if fails — redirect to Login
