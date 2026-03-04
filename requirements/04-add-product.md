# REQ-04: Add Product

## Overview
Four methods to add products. All methods ultimately create product documents. LLM is used to auto-parse, auto-categorize, and auto-assign consumers.

## Input Methods

### 1. Email Forward
- User forwards an order confirmation email to a dedicated app email address (e.g. `inbox@neverempty.app`)
- Backend receives the email, sends content to LLM for parsing
- LLM extracts: product names, quantities, prices, store category
- Parsed products appear in the app as a "pending import" list
- User reviews, edits if needed, confirms to save
- Store category is auto-assigned (grocery, household supplies, etc.)

### 2. Photo Receipt (OCR)
- User taps "Scan Receipt" and takes a photo or picks from gallery
- Image sent to backend → LLM-based OCR extraction
- Extracted data: product names, quantities, prices, store category
- **Review screen**: list of extracted products, each editable
- User confirms — products are saved
- If OCR fails or is partial: user can manually edit/complete

### 3. Barcode Scan
- User taps "Scan Barcode" — opens camera with barcode scanner
- Scanned barcode looked up in product database (e.g. Open Food Facts API)
- If found: auto-fill name, category, default quantity = 1
- If not found: fallback to manual entry with barcode stored
- User reviews auto-filled data, confirms to save

### 4. Manual Entry
- Form fields:
  - **Name** (required): text input
  - **Quantity** (required): numeric input, default 1
  - **Category** (required): dropdown — predefined + custom categories
  - **Price** (optional): amount + currency selector
  - **Consumers** (auto-assigned): multi-select chips from household categories
    - LLM suggests which household members consume this product
    - User can adjust before saving
  - **Run-out date** (optional): date picker for manual override
    - If not set: system will calculate based on consumption patterns
- "Save" button

## LLM Auto-Assignment
For all input methods:
- **Category**: LLM classifies product into store category (grocery, household, pharmacy, etc.)
- **Consumers**: LLM determines which household members likely use this product based on product type and household composition
- Both are shown to user for review/approval before final save

## Data Created
Each product saved to `product` collection:
```json
{
  "owner": "<user_id>",
  "name": "Milk 2%",
  "quantity": 2,
  "category": "grocery",
  "last_bought": "2026-03-04",
  "price": { "currency": "USD", "amount": 3.99 },
  "consumers": ["adult", "child"],
  "run_out_at": { "deadline": null, "type": "calculated" },
  "notification": { "run_out_soon": false, "ran_out": false }
}
```
Note: `run_out_at.deadline` is null until calculated by the batch process or set manually.
