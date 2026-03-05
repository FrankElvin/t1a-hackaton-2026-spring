package com.neverempty.backend.service;

import com.neverempty.backend.config.AppProperties;
import com.neverempty.backend.dto.ItemForecast;
import com.neverempty.backend.model.Item;
import com.neverempty.backend.model.Product;
import com.neverempty.backend.repository.ItemRepository;
import com.neverempty.backend.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.AbstractMap;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final AppProperties properties;
    private final ProductRepository productRepository;
    private final HouseholdService householdService;
    private final EmailParserService emailParserService;
    private final MongoTemplate mongoTemplate;
    private final ItemRepository itemRepository;
    private final ForecastService forecastService;
    private final SettingsService settingsService;

    private static final int ITEM_LOOK_AHEAD_DAYS = 14;

    public record NotificationSummary(
            List<ProductAlert> runningOutSoon,
            List<ProductAlert> ranOut
    ) {}

    public record ProductAlert(
            String productId,
            String productName,
            long daysRemaining
    ) {}

    public record NotificationCounts(
            int runningOutSoon,
            int ranOut
    ) {}

    /**
     * Check a single household for products needing notifications.
     * Updates notification flags on matching products.
     */
    public NotificationSummary checkAndNotifyHousehold(String userId) {
        var today = LocalDate.now();
        var soonThreshold = today.plusDays(properties.notification().soonDays());

        // Products running out soon (not yet notified)
        var soonQuery = new Query(Criteria.where("owner").is(userId)
                .and("run_out_at.deadline").gte(today).lte(soonThreshold)
                .and("notification.run_out_soon").is(false));
        var soonProducts = mongoTemplate.find(soonQuery, Product.class);

        var soonAlerts = soonProducts.stream()
                .map(p -> new ProductAlert(
                        p.getId(),
                        p.getName(),
                        ChronoUnit.DAYS.between(today, p.getRunOutAt().getDeadline())
                ))
                .toList();

        // Mark as notified
        if (!soonProducts.isEmpty()) {
            var ids = soonProducts.stream().map(Product::getId).toList();
            var update = new Update().set("notification.run_out_soon", true);
            mongoTemplate.updateMulti(
                    new Query(Criteria.where("_id").in(ids)),
                    update, Product.class
            );
        }

        // Products already past deadline (not yet notified)
        var expiredQuery = new Query(Criteria.where("owner").is(userId)
                .and("run_out_at.deadline").lt(today)
                .and("notification.ran_out").is(false));
        var expiredProducts = mongoTemplate.find(expiredQuery, Product.class);

        var expiredAlerts = expiredProducts.stream()
                .map(p -> new ProductAlert(
                        p.getId(),
                        p.getName(),
                        ChronoUnit.DAYS.between(p.getRunOutAt().getDeadline(), today)
                ))
                .toList();

        // Mark as notified
        if (!expiredProducts.isEmpty()) {
            var ids = expiredProducts.stream().map(Product::getId).toList();
            var update = new Update().set("notification.ran_out", true);
            mongoTemplate.updateMulti(
                    new Query(Criteria.where("_id").in(ids)),
                    update, Product.class
            );
        }

        return new NotificationSummary(soonAlerts, expiredAlerts);
    }

    /**
     * Format and send a notification email summarizing running-out products.
     */
    public void sendNotificationEmail(String userEmail, NotificationSummary summary) {
        if (summary.runningOutSoon().isEmpty() && summary.ranOut().isEmpty()) {
            return;
        }

        var sb = new StringBuilder("Never Empty - Notification Summary\n\n");

        if (!summary.runningOutSoon().isEmpty()) {
            sb.append("Items running out soon:\n");
            for (var alert : summary.runningOutSoon()) {
                sb.append("  - ").append(alert.productName())
                        .append(" (").append(alert.daysRemaining()).append(" days)\n");
            }
            sb.append("\n");
        }

        if (!summary.ranOut().isEmpty()) {
            sb.append("Items that have run out:\n");
            for (var alert : summary.ranOut()) {
                sb.append("  - ").append(alert.productName())
                        .append(" (").append(alert.daysRemaining()).append(" days ago)\n");
            }
        }

        emailParserService.sendEmail(userEmail, "Never Empty: Items need your attention", sb.toString());
    }

    /**
     * Run notification batch for all active households.
     * Uses distributed locking per household.
     */
    public int runNotificationBatch() {
        var households = householdService.getActiveHouseholds();
        int processed = 0;

        for (var household : households) {
            var userId = household.getUserId();
            if (!householdService.acquireLock(userId, "notification-batch", 300)) {
                log.debug("Skipping household {}: lock not acquired", userId);
                continue;
            }

            try {
                var summary = checkAndNotifyHousehold(userId);
                // TODO: resolve user email from Keycloak or user profile
                // sendNotificationEmail(userEmail, summary);
                processed++;
            } catch (Exception e) {
                log.error("Failed to process notifications for household {}", userId, e);
            } finally {
                householdService.releaseLock(userId, "notification-batch");
            }
        }

        log.info("Notification batch completed: {} households processed", processed);
        return processed;
    }

    /**
     * Check items for a user and send a notification email if any will run out
     * within the next {@code ITEM_LOOK_AHEAD_DAYS} days.
     *
     * @param userId                 the user to process
     * @param checkDate              the reference date for the forecast calculation
     * @param ignorePrevNotification if true, re-notify even for already-notified items
     */
    public void processItemNotifications(String userId, Instant checkDate, boolean ignorePrevNotification) {
        var settings = settingsService.getSettings(userId);
        var notificationConfig = settings.getNotification();

        if (!notificationConfig.isEnabled() || notificationConfig.getEmail() == null
                || notificationConfig.getEmail().isBlank()) {
            log.debug("Notifications disabled or email not set for user {}", userId);
            return;
        }

        var checkLocalDate = checkDate.atZone(ZoneOffset.UTC).toLocalDate();
        var today = LocalDate.now();

        var allItems = itemRepository.findByUserId(userId);

        var itemsWithForecast = allItems.stream()
                .filter(item -> ignorePrevNotification || !item.isNotifiedRunOut())
                .map(item -> new AbstractMap.SimpleEntry<>(item, forecastService.buildForecast(item, today)))
                .filter(entry -> {
                    LocalDate depletionDate = entry.getValue().estimatedDepletionDate();
                    long daysFromCheck = ChronoUnit.DAYS.between(checkLocalDate, depletionDate);
                    return daysFromCheck >= 0 && daysFromCheck <= ITEM_LOOK_AHEAD_DAYS;
                })
                .toList();

        if (itemsWithForecast.isEmpty()) {
            log.debug("No items to notify for user {}", userId);
            return;
        }

        var html = buildNotificationHtml(itemsWithForecast, checkLocalDate);
        emailParserService.sendHtmlEmail(
                notificationConfig.getEmail(),
                "NeverEmpty: Items running out soon",
                html
        );

        var notifiedIds = itemsWithForecast.stream()
                .map(e -> e.getKey().getId())
                .toList();
        mongoTemplate.updateMulti(
                new Query(Criteria.where("_id").in(notifiedIds)),
                new Update().set("notified_run_out", true),
                Item.class
        );

        log.info("Sent run-out notification to {} for {} item(s)", notificationConfig.getEmail(), notifiedIds.size());
    }

    /**
     * Scheduled job: runs every 5 minutes, processes all active households.
     */
    @Scheduled(fixedRate = 5 * 60 * 1000)
    public void runItemNotificationSchedule() {
        var households = householdService.getActiveHouseholds();
        for (var household : households) {
            var userId = household.getUserId();
            if (!householdService.acquireLock(userId, "item-notification", 300)) {
                log.debug("Skipping household {}: lock not acquired", userId);
                continue;
            }
            try {
                processItemNotifications(userId, Instant.now(), false);
            } catch (Exception e) {
                log.error("Failed to process item notifications for household {}", userId, e);
            } finally {
                householdService.releaseLock(userId, "item-notification");
            }
        }
    }

    private String buildNotificationHtml(
            List<AbstractMap.SimpleEntry<Item, ItemForecast>> itemsWithForecast,
            LocalDate checkDate) {
        var appUrl = properties.baseUrl() != null ? properties.baseUrl() : "http://localhost:3000";

        var rows = new StringBuilder();
        for (var entry : itemsWithForecast) {
            var item = entry.getKey();
            var forecast = entry.getValue();
            int days = forecast.daysUntilDepletion();
            String urgencyColor = days <= 5 ? "#dc2626" : "#d97706";
            String urgencyLabel = days == 0 ? "today"
                    : days == 1 ? "tomorrow"
                    : "in " + days + " days";
            rows.append("""
                    <tr>
                      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:15px;color:#1e293b;">%s</td>
                      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#64748b;">%.1f %s</td>
                      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#64748b;">%s</td>
                      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;font-weight:600;color:%s;">%s</td>
                    </tr>
                    """.formatted(
                    escapeHtml(item.getName()),
                    item.getCurrentQuantity(),
                    escapeHtml(item.getUnit() != null ? item.getUnit() : ""),
                    forecast.estimatedDepletionDate(),
                    urgencyColor,
                    urgencyLabel
            ));
        }

        return """
                <!DOCTYPE html>
                <html lang="en">
                <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                  <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
                    <tr><td align="center">
                      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

                        <!-- Header -->
                        <tr>
                          <td style="background:#1e293b;padding:28px 32px;">
                            <p style="margin:0;font-size:22px;font-weight:700;color:#f1f5f9;letter-spacing:-0.3px;">
                              🛒 NeverEmpty
                            </p>
                            <p style="margin:6px 0 0;font-size:13px;color:#94a3b8;">
                              Inventory alert for %s
                            </p>
                          </td>
                        </tr>

                        <!-- Intro -->
                        <tr>
                          <td style="padding:24px 32px 8px;">
                            <p style="margin:0;font-size:15px;color:#334155;line-height:1.6;">
                              The following items in your household are expected to run out
                              within the next <strong>%d days</strong>. Time to restock!
                            </p>
                          </td>
                        </tr>

                        <!-- Table -->
                        <tr>
                          <td style="padding:16px 32px 24px;">
                            <table width="100%%" cellpadding="0" cellspacing="0"
                                   style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
                              <thead>
                                <tr style="background:#f8fafc;">
                                  <th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e2e8f0;">Item</th>
                                  <th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e2e8f0;">Quantity left</th>
                                  <th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e2e8f0;">Runs out on</th>
                                  <th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e2e8f0;">When</th>
                                </tr>
                              </thead>
                              <tbody>
                                %s
                              </tbody>
                            </table>
                          </td>
                        </tr>

                        <!-- CTA -->
                        <tr>
                          <td style="padding:0 32px 32px;">
                            <a href="%s" style="display:inline-block;padding:12px 24px;background:#3b82f6;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
                              Open NeverEmpty →
                            </a>
                          </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
                            <p style="margin:0;font-size:12px;color:#94a3b8;">
                              You are receiving this because notifications are enabled in your NeverEmpty settings.
                              Calculated as of %s.
                            </p>
                          </td>
                        </tr>

                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
                """.formatted(checkDate, ITEM_LOOK_AHEAD_DAYS, rows, appUrl, checkDate);
    }

    private static String escapeHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    /**
     * Get notification counts for in-app badge display.
     */
    public NotificationCounts getNotificationCounts(String owner) {
        var today = LocalDate.now();
        var soonThreshold = today.plusDays(properties.notification().soonDays());

        var soonCount = mongoTemplate.count(
                new Query(Criteria.where("owner").is(owner)
                        .and("run_out_at.deadline").gte(today).lte(soonThreshold)),
                Product.class
        );

        var expiredCount = mongoTemplate.count(
                new Query(Criteria.where("owner").is(owner)
                        .and("run_out_at.deadline").lt(today)),
                Product.class
        );

        return new NotificationCounts((int) soonCount, (int) expiredCount);
    }
}
