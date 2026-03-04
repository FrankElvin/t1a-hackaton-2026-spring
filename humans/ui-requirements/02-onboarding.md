# REQ-02: Onboarding — Household Setup

## Overview
After registration, the user completes a questionnaire about household composition. This is a one-time setup (editable later in Settings).

## Questionnaire Flow

### Single Screen: Family Composition

#### People (PersonCategory: ADULT | CHILD)
- **Adults** — numeric stepper (+ / −), minimum 0, default 1
- **Children** — numeric stepper (+ / −), minimum 0, default 0
- At least 1 person total required to proceed

#### Pets (PetCategory: CAT | DOG | PARROT | SMALL_ANIMAL | OTHER)
- List of added pets, each showing: emoji + name + type label + trash icon to remove
- "Add a pet" button opens an inline form:
  - Type dropdown: Cat 🐱 / Dog 🐶 / Parrot 🦜 / Small Animal 🐭 / Other 🐾
  - Name input (optional)
  - "Add" button to confirm, "Cancel" to dismiss

### Actions
- "Continue" button — saves household, redirects to Dashboard (empty state)
- No "Skip" — household composition is required

## Data Saved
Calls `PUT /household` with:
```json
{
  "members": [
    { "category": "ADULT" },
    { "category": "ADULT" },
    { "category": "CHILD" }
  ],
  "pets": [
    { "name": "Whiskers", "category": "CAT" },
    { "name": "Rex", "category": "DOG" }
  ]
}
```
