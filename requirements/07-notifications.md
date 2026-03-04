# REQ-07: Notifications

## Overview
Two notification channels: email and in-app. Triggered by batch processing when products approach their run-out deadline.

## Notification Types

### Run Out Soon
- Trigger: product's `run_out_at.deadline` is within N days (default: 3 days)
- Channels: email + in-app
- Frequency: once per product per trigger (don't spam)
- Sets `notification.run_out_soon = true` on the product

### Ran Out
- Trigger: product's `run_out_at.deadline` has passed
- Channels: email + in-app
- Sets `notification.ran_out = true` on the product

## Email Notifications
- Batch job runs periodically (e.g. daily)
- Aggregates all products running out soon for a household
- Sends a single email per household with a summary list:
  - "3 items running out soon: Milk (2 days), Bread (1 day), Soap (3 days)"
- Link to open the app / dashboard

## In-App Notifications
- Badge count on Dashboard tab (number of items running out)
- Running-out section on Dashboard highlights urgent items
- Optional: notification bell icon with a dropdown list of recent alerts

## User Control
- Per-product: notification toggles in Product Detail (REQ-06)
- Global: notification preferences in Settings (REQ-08) — enable/disable email notifications
