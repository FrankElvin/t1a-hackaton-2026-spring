# REQ-03: Dashboard

## Overview
The main screen after login. Minimal: shows products running out soon and a prompt to add products.

## Layout

### Running Out Soon Section
- Header: "Running Out Soon"
- List of product cards that will run out within the next 7 days (configurable?)
- Each card shows: product name, run-out date, category tag
- Tapping a card opens Product Detail screen
- If no products running out: show a friendly "All good!" message

### Empty State (new user)
- Shown when user has zero products
- Message: "Your pantry is empty! Add your first product."
- Large "+" / "Add Product" button
- Brief explanation of input methods (photo, email, barcode, manual)

### Quick Add Button
- Floating action button (FAB) or prominent "+" button
- Always visible on Dashboard
- Opens Add Product flow (see REQ-04)

## Responsive
- Mobile: single column, cards stack vertically
- Desktop: cards in a grid (2-3 columns)
