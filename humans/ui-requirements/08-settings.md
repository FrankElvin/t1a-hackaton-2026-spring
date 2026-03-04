# REQ-08: Settings

## Overview
User can manage account and household settings.

## Sections

### Account
- **Email**: display current email, button to change
- **Password**: "Change password" button → current password + new password + confirm
- **Log out**: button, clears JWT, redirects to Login

### Household Composition
- Same UI as onboarding questionnaire (REQ-02)
- Shows current categories with counts
- User can:
  - Adjust counts (stepper + / −)
  - Add new custom categories
  - Remove custom categories (with confirmation if products use them as consumers)
- "Save" button to persist changes

### Notification Preferences
- Toggle: enable/disable email notifications
- Running-out threshold: number input (days before deadline to notify, default 3)

### Product Categories
- List of all categories (predefined + custom)
- User can add new custom categories
- User can rename or delete custom categories
  - Deleting a category: confirmation + reassign affected products

### Danger Zone
- "Delete account" — confirmation dialog, deletes all data
