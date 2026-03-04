# REQ-09: Navigation & Layout

## Overview
Responsive navigation: bottom tabs on mobile, sidebar on desktop.

## Navigation Items
1. **Dashboard** — home icon, main screen (REQ-03)
2. **Products** — list icon, product list (REQ-05)
3. **Add** — "+" icon, add product flow (REQ-04)
4. **Settings** — gear icon, settings screen (REQ-08)

## Mobile Layout (< 768px)
- Bottom tab bar with 4 items
- Fixed at the bottom of the screen
- Active tab highlighted
- "Add" button may be a centered FAB slightly raised above the tab bar
- Content area scrolls above the tab bar

## Tablet Layout (768px — 1024px)
- Same as mobile but with wider content area
- Cards may display in 2-column grid

## Desktop Layout (> 1024px)
- Left sidebar with navigation items (icons + labels)
- Sidebar is collapsible (icon-only mode)
- Main content area takes remaining width
- Cards in 2-3 column grid

## General
- All screens have a top bar with:
  - Screen title (left)
  - Notification bell icon with badge count (right)
- Transitions: simple fade or slide between screens
- Mobile-first CSS: base styles for mobile, media queries scale up
- Viewport meta tag: `<meta name="viewport" content="width=device-width, initial-scale=1">`
- Language: English only
