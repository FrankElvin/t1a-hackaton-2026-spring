package com.neverempty.backend.service;

import com.neverempty.backend.dto.CreateItemRequest;
import com.neverempty.backend.dto.MarkConsumedRequest;
import com.neverempty.backend.model.Item;
import com.neverempty.backend.model.enums.ItemCategory;
import com.neverempty.backend.repository.ItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ItemService {

    private final ItemRepository repository;

    public List<Item> listItems(String userId, ItemCategory category, String storeId) {
        if (category != null) {
            return repository.findByUserIdAndCategory(userId, category);
        }
        if (storeId != null) {
            return repository.findByUserIdAndStoreId(userId, storeId);
        }
        return repository.findByUserId(userId);
    }

    public Optional<Item> getItem(String userId, String itemId) {
        return repository.findByIdAndUserId(itemId, userId);
    }

    /**
     * Creates a new item and calculates usagePerDay if lastBoughtDate and daysToRestock are provided.
     * Formula: usagePerDay = currentQuantity / (calcDate - lastBoughtDate + daysToRestock)
     */
    public Item createItem(String userId, CreateItemRequest request, LocalDate calcDate) {
        Double usagePerDay = null;
        if (request.lastBoughtDate() != null && !request.lastBoughtDate().isBlank()
                && request.daysToRestock() != null) {
            try {
                LocalDate lastBought = LocalDate.parse(request.lastBoughtDate());
                long daysSinceLastBought = ChronoUnit.DAYS.between(lastBought, calcDate);
                long totalDays = daysSinceLastBought + request.daysToRestock().longValue();
                if (totalDays > 0) {
                    usagePerDay = request.currentQuantity() / (double) totalDays;
                }
            } catch (Exception ignored) {
                // malformed lastBoughtDate — skip usagePerDay calculation
            }
        }

        var item = Item.builder()
                .userId(userId)
                .name(request.name())
                .category(request.category())
                .currentQuantity(request.currentQuantity())
                .unit(request.unit())
                .storeId(request.storeId())
                .price(request.price())
                .consumerCategory(request.consumerCategory())
                .daysToRestock(request.daysToRestock())
                .usagePerDay(usagePerDay)
                .autoCalc(request.autoCalc())
                .lastBoughtDate(request.lastBoughtDate())
                .standardPurchaseQuantity(
                        request.standardPurchaseQuantity() != null
                                ? request.standardPurchaseQuantity()
                                : request.currentQuantity())
                .build();
        return repository.save(item);
    }

    public Optional<Item> updateItem(String userId, String itemId, CreateItemRequest request) {
        return repository.findByIdAndUserId(itemId, userId)
                .map(existing -> {
                    existing.setName(request.name());
                    existing.setCategory(request.category());
                    existing.setCurrentQuantity(request.currentQuantity());
                    existing.setUnit(request.unit());
                    existing.setStoreId(request.storeId());
                    existing.setPrice(request.price());
                    existing.setConsumerCategory(request.consumerCategory());
                    existing.setDaysToRestock(request.daysToRestock());
                    existing.setAutoCalc(request.autoCalc());
                    existing.setLastBoughtDate(request.lastBoughtDate());
                    existing.setStandardPurchaseQuantity(request.standardPurchaseQuantity());
                    return repository.save(existing);
                });
    }

    public boolean deleteItem(String userId, String itemId) {
        var existing = repository.findByIdAndUserId(itemId, userId);
        if (existing.isPresent()) {
            repository.deleteByIdAndUserId(itemId, userId);
            return true;
        }
        return false;
    }

    /**
     * Mark item as fully depleted.
     * If autoCalc=true OR usagePerDay was never set (first depletion), recalculates usagePerDay
     * using actual depletion date vs. lastBoughtDate.
     */
    public Optional<Item> markDepleted(String userId, String itemId, MarkConsumedRequest request) {
        return repository.findByIdAndUserId(itemId, userId)
                .map(item -> {
                    LocalDate depletedAt = request.depletedAt() != null
                            ? request.depletedAt() : LocalDate.now();

                    boolean shouldRecalc = Boolean.TRUE.equals(item.getAutoCalc())
                            || item.getDaysToRestock() == null;

                    if (shouldRecalc && item.getLastBoughtDate() != null
                            && !item.getLastBoughtDate().isBlank()) {
                        try {
                            LocalDate lastBought = LocalDate.parse(item.getLastBoughtDate());
                            long actualDays = ChronoUnit.DAYS.between(lastBought, depletedAt);
                            if (actualDays > 0) {
                                double originalQty;
                                if (item.getUsagePerDay() != null) {
                                    // Reconstruct original quantity at lastBoughtDate
                                    originalQty = item.getCurrentQuantity()
                                            + item.getUsagePerDay() * actualDays;
                                } else {
                                    // Daily updates never ran — currentQuantity ≈ original qty
                                    originalQty = item.getCurrentQuantity();
                                }
                                item.setUsagePerDay(originalQty / (double) actualDays);
                            }
                        } catch (Exception ignored) {
                            // malformed lastBoughtDate — skip recalc
                        }
                    }

                    item.setCurrentQuantity(0);
                    item.setDaysToRestock(0.0);
                    return repository.save(item);
                });
    }

    /**
     * Mark item as bought.
     * If autoCalc=true:
     *  - usagePerDay known: add standardPurchaseQty to stock, recalculate daysToRestock
     *  - usagePerDay unknown: estimate from elapsed time since lastBoughtDate, then same
     */
    public Optional<Item> markAsBought(String userId, String itemId, LocalDate boughtDate) {
        return repository.findByIdAndUserId(itemId, userId)
                .map(item -> {
                    double usualQty = item.getStandardPurchaseQuantity() != null
                            ? item.getStandardPurchaseQuantity()
                            : item.getCurrentQuantity();

                    if (Boolean.TRUE.equals(item.getAutoCalc())) {
                        if (item.getUsagePerDay() != null && item.getUsagePerDay() > 0) {
                            double newQty = item.getCurrentQuantity() + usualQty;
                            item.setCurrentQuantity(newQty);
                            item.setDaysToRestock(newQty / item.getUsagePerDay());
                        } else if (item.getLastBoughtDate() != null
                                && !item.getLastBoughtDate().isBlank()) {
                            try {
                                LocalDate prevDate = LocalDate.parse(item.getLastBoughtDate());
                                long daysDiff = ChronoUnit.DAYS.between(prevDate, boughtDate);
                                if (daysDiff > 0 && item.getCurrentQuantity() > 0) {
                                    double calcUsagePerDay = item.getCurrentQuantity() / (double) daysDiff;
                                    item.setUsagePerDay(calcUsagePerDay);
                                    double newQty = item.getCurrentQuantity() + usualQty;
                                    item.setCurrentQuantity(newQty);
                                    item.setDaysToRestock(newQty / calcUsagePerDay);
                                } else {
                                    item.setCurrentQuantity(item.getCurrentQuantity() + usualQty);
                                }
                            } catch (Exception ignored) {
                                item.setCurrentQuantity(item.getCurrentQuantity() + usualQty);
                            }
                        } else {
                            item.setCurrentQuantity(item.getCurrentQuantity() + usualQty);
                        }
                    }

                    item.setLastBoughtDate(boughtDate.toString());
                    return repository.save(item);
                });
    }
}
