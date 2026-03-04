# REQ-02: Onboarding — Household Setup

## Overview
After registration, the user completes a questionnaire about household composition. This is a one-time setup (editable later in Settings).

## Questionnaire Flow

### Single Screen: Family Composition
- Default categories shown: "Adults", "Children"
- Each category has a numeric stepper (+ / −), minimum 0
- "Add custom category" button at the bottom
  - User types a name (e.g. "Bob the dog", "Grandma")
  - Gets its own stepper, default count = 1
- User can remove custom categories (trash icon)
- At least 1 member total required to proceed

### Actions
- "Continue" button — saves household, redirects to Dashboard (empty state)
- No "Skip" — household composition is required

## Data Saved
Writes to `household` collection:
```json
{
  "user_id": "<from JWT>",
  "inhabitants": [
    { "adult": 2 },
    { "child": 1 },
    { "Bob the dog": 1 }
  ],
  "active": true,
  "lock": { "locked": false }
}
```
