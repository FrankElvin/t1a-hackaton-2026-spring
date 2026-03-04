# REQ-04: Add Product

## Overview
Four methods to add products. All methods ultimately create item documents via `POST /items`.
LLM is used to auto-parse and auto-categorize items imported from receipts and emails.

## Input Methods

### 1. Manual Entry
Form fields matching `CreateItemRequest`:
- **Name** (required): text input
- **Quantity** (required): numeric input, default 1
- **Unit** (required): text input with quick-pick presets (pcs, kg, g, L, ml, pack, box, bottle, bag, roll)
- **Category** (optional): dropdown — `ItemCategory` enum values: FOOD, BEVERAGES, CLEANING, PERSONAL_CARE, PET_FOOD, MEDICINE, OTHER
- **Consumed by** (optional): dropdown — single `ConsumerCategory` value: ADULT, CHILD, CAT, DOG, PARROT, SMALL_ANIMAL
- **Price** (optional): numeric input (currency is stored on the backend)
- **Monthly usage rate** (optional): numeric input — units consumed per month. If left empty, the system calculates it automatically from purchase history.
- "Save" button → `POST /items`

### 2. Photo Receipt (OCR)
- User taps upload area or uses camera to take a photo of a store receipt
- Image sent to backend: `POST /items/import/receipt` (multipart/form-data, field `image`)
- **Review screen**: shows list of imported items (name, quantity, unit). Items are already saved.
- Skipped lines (lines the backend could not parse) are shown separately
- "Scan Another" or "Done" actions

### 3. Email Forward
- App displays the forwarding address: `inbox@neverempty.app` (with copy button)
- User forwards any store order confirmation email to this address
- Backend parses the email and adds products automatically
- **Alternative**: user pastes raw email content directly into the app → `POST /items/import/email` with `{ rawEmail: string }`
- Both paths return the same review screen as receipt import

### 4. Barcode Scan
- Opens camera using the browser `BarcodeDetector` API (Chrome/Edge) for live scanning
- When a barcode is detected, product is looked up in Open Food Facts (public API, no backend required)
- If found: pre-fills the Manual Entry form (name, quantity, unit) for user review before saving
- If not found: pre-fills name as `Product <barcode>` for manual completion
- Manual barcode entry fallback: text field + "Look up" button for devices without camera support

## Data Created
Each product is saved via `POST /items` (`CreateItemRequest`):
```json
{
  "name": "Oat Milk",
  "currentQuantity": 2,
  "unit": "L",
  "category": "BEVERAGES",
  "consumerCategory": "ADULT",
  "price": 89.99,
  "monthlyConsumptionRate": 8.0
}
```
Fields `category`, `consumerCategory`, `price`, `monthlyConsumptionRate` are optional.

## Changes from original spec
- **Unit field added** (required by API, was missing from original requirement)
- **Consumers** changed from multi-select to single `ConsumerCategory` value (matches API)
- **"Run-out date"** removed — replaced by `monthlyConsumptionRate` (system calculates depletion dates)
- **Currency selector** removed — price is a plain number; currency is a backend concern
- **Custom categories** removed — `ItemCategory` enum is fixed; no free-form category input
- **Barcode** uses Open Food Facts (public) instead of a dedicated backend endpoint
