package com.neverempty.backend.service;

import com.neverempty.backend.config.AppProperties;
import com.neverempty.backend.model.Product;
import com.neverempty.backend.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
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
