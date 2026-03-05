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

    public Item createItem(String userId, CreateItemRequest request) {
        var item = Item.builder()
                .userId(userId)
                .name(request.name())
                .category(request.category())
                .currentQuantity(request.currentQuantity())
                .unit(request.unit())
                .storeId(request.storeId())
                .price(request.price())
                .consumerCategory(request.consumerCategory())
                .monthlyConsumptionRate(request.monthlyConsumptionRate())
                .autoCalc(request.autoCalc())
                .lastBoughtDate(request.lastBoughtDate())
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
                    existing.setMonthlyConsumptionRate(request.monthlyConsumptionRate());
                    existing.setAutoCalc(request.autoCalc());
                    existing.setLastBoughtDate(request.lastBoughtDate());
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

    public Optional<Item> markConsumed(String userId, String itemId, MarkConsumedRequest request) {
        return repository.findByIdAndUserId(itemId, userId)
                .map(item -> {
                    double consumed = request.quantityConsumed() != null ? request.quantityConsumed() : 0.0;

                    // autoCalc: if fully consumed, update rate based on time since last purchase
                    if (Boolean.TRUE.equals(item.getAutoCalc())
                            && item.getLastBoughtDate() != null
                            && !item.getLastBoughtDate().isBlank()
                            && item.getCurrentQuantity() > 0
                            && consumed >= item.getCurrentQuantity()) {
                        try {
                            LocalDate purchaseDate = LocalDate.parse(item.getLastBoughtDate());
                            LocalDate depletedAt = request.depletedAt() != null
                                    ? request.depletedAt() : LocalDate.now();
                            long daysDiff = ChronoUnit.DAYS.between(purchaseDate, depletedAt);
                            if (daysDiff > 0) {
                                double measuredRate = (item.getCurrentQuantity() / (double) daysDiff) * 30.0;
                                double existingRate = item.getMonthlyConsumptionRate() != null
                                        ? item.getMonthlyConsumptionRate() : measuredRate;
                                item.setMonthlyConsumptionRate((existingRate + measuredRate) / 2.0);
                            }
                        } catch (Exception ignored) {
                            // malformed lastBoughtDate — skip autoCalc
                        }
                    }

                    item.setCurrentQuantity(Math.max(0, item.getCurrentQuantity() - consumed));
                    return repository.save(item);
                });
    }

    public Optional<Item> markAsBought(String userId, String itemId, LocalDate boughtDate) {
        return repository.findByIdAndUserId(itemId, userId)
                .map(item -> {
                    // autoCalc: recalculate monthlyConsumptionRate from real purchase interval
                    if (Boolean.TRUE.equals(item.getAutoCalc())
                            && item.getLastBoughtDate() != null
                            && !item.getLastBoughtDate().isBlank()
                            && item.getCurrentQuantity() > 0) {
                        try {
                            LocalDate prevDate = LocalDate.parse(item.getLastBoughtDate());
                            long daysDiff = ChronoUnit.DAYS.between(prevDate, boughtDate);
                            if (daysDiff > 0) {
                                double measuredRate = (item.getCurrentQuantity() / (double) daysDiff) * 30.0;
                                // Blend with existing rate: average smooths out outlier purchases
                                double existingRate = item.getMonthlyConsumptionRate() != null
                                        ? item.getMonthlyConsumptionRate() : measuredRate;
                                item.setMonthlyConsumptionRate((existingRate + measuredRate) / 2.0);
                            }
                        } catch (Exception ignored) {
                            // malformed lastBoughtDate — skip autoCalc
                        }
                    }
                    item.setLastBoughtDate(boughtDate.toString());
                    return repository.save(item);
                });
    }

    public Optional<Item> setConsumptionRate(String userId, String itemId, double monthlyRate) {
        return repository.findByIdAndUserId(itemId, userId)
                .map(item -> {
                    item.setMonthlyConsumptionRate(monthlyRate);
                    return repository.save(item);
                });
    }
}
