# REQ-05: Product List

## Overview
Paginated list of all household products with swipe actions.

## Screen Layout

### Product Card (list item)
- Product name (bold)
- Run-out date (color-coded: red if < 3 days, orange if < 7 days, green otherwise)
- Category tag (e.g. "grocery", "household")
- Tap → opens Product Detail screen (REQ-06)

### Sorting
- Default: sorted by run-out date ascending (soonest first)
- Toggle: ascending / descending

### Pagination
- Infinite scroll or "Load more" button
- Page size: ~20 items

### Swipe Actions
- **Swipe left → Delete**: confirmation dialog, then remove product
- **Swipe right → Mark as Bought**: quick action
  - Auto-sets `last_bought` = today
  - Recalculates `run_out_at.deadline` (triggers batch recalculation)
  - Quantity stays the same
  - Brief toast/snackbar: "Milk marked as bought"

### Search / Filter
- Search bar at the top: filter by product name
- Optional category filter chips below search bar

## Responsive
- Mobile: full-width cards, swipe gestures enabled
- Desktop: table-like layout with action buttons instead of swipe, wider cards
