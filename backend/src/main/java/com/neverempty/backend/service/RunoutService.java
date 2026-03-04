package com.neverempty.backend.service;

import com.neverempty.backend.model.Product;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.util.Pair;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Batch run-out deadline calculation service.
 * Uses LLM to estimate when products will run out based on consumption patterns.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RunoutService {

    private final LlmService llmService;
    private final ProductService productService;
    private final HouseholdService householdService;

    /**
     * Estimate run-out date for a single product using LLM.
     */
    public Optional<LocalDate> estimateSingleProduct(Product product, List<String> householdCategories) {
        try {
            var days = llmService.estimateRunoutDays(
                    product.getName(),
                    product.getQuantity(),
                    product.getCategory() != null ? product.getCategory() : "other",
                    product.getConsumers(),
                    product.getLastBought()
            );
            return Optional.of(product.getLastBought().plusDays(days));
        } catch (Exception e) {
            log.warn("Failed to estimate runout for product {}: {}", product.getId(), e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Calculate run-out deadlines for all products in a household
     * that need calculation (deadline is null, type is "calculated").
     * Returns count of products updated.
     */
    public int calculateForHousehold(String userId) {
        var products = productService.getProductsNeedingCalculation(userId);
        if (products.isEmpty()) return 0;

        var categories = householdService.getConsumerCategories(userId);
        var updates = new ArrayList<Pair<String, LocalDate>>();

        for (var product : products) {
            estimateSingleProduct(product, categories)
                    .ifPresent(deadline -> updates.add(Pair.of(product.getId(), deadline)));
        }

        if (updates.isEmpty()) return 0;
        return productService.bulkUpdateRunout(updates);
    }

    /**
     * Run calculation batch for all active households.
     * Uses distributed locking per household.
     */
    public int runCalculationBatch() {
        var households = householdService.getActiveHouseholds();
        int totalUpdated = 0;

        for (var household : households) {
            var userId = household.getUserId();
            if (!householdService.acquireLock(userId, "runout-batch", 600)) {
                log.debug("Skipping household {}: lock not acquired", userId);
                continue;
            }

            try {
                totalUpdated += calculateForHousehold(userId);
            } catch (Exception e) {
                log.error("Failed to calculate runout for household {}", userId, e);
            } finally {
                householdService.releaseLock(userId, "runout-batch");
            }
        }

        log.info("Runout calculation batch completed: {} products updated", totalUpdated);
        return totalUpdated;
    }
}
