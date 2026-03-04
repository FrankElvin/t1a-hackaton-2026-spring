# REQ-06: Product Detail

## Overview
Read-only view of a single product with an edit mode.

## Read-Only View
Displays all product fields:
- Name
- Quantity
- Category (tag)
- Price (amount + currency)
- Last bought date
- Consumers (chips showing household categories)
- Run-out date:
  - Shows calculated prediction with label "Predicted" or manual date with label "Manual"
  - Visual indicator (days remaining, color-coded)
- Notification status: icons showing if notifications are enabled

### Actions
- "Edit" button → switches to edit mode
- "Delete" button → confirmation dialog → delete product
- Back button → return to Product List

## Edit Mode
All fields become editable:
- Name: text input
- Quantity: numeric stepper
- Category: dropdown (predefined + custom)
- Price: amount input + currency selector
- Consumers: multi-select chips from household categories
- Run-out date: date picker
  - If user sets a date: `run_out_at.type` = "manual"
  - If user clears date: `run_out_at.type` = "calculated", system will recalculate
- Notification toggles: run_out_soon (on/off), ran_out (on/off)

### Actions
- "Save" button → validate and save, return to read-only view
- "Cancel" button → discard changes, return to read-only view
