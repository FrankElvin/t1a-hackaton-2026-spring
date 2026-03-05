package com.neverempty.backend.service;

import com.neverempty.backend.dto.AddQuantityRequest;
import com.neverempty.backend.dto.CreateItemRequest;
import com.neverempty.backend.dto.MarkConsumedRequest;
import com.neverempty.backend.model.Item;
import com.neverempty.backend.model.enums.ItemCategory;
import com.neverempty.backend.repository.ItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

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
                    double newQuantity = item.getCurrentQuantity() - consumed;
                    item.setCurrentQuantity(Math.max(0, newQuantity));
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

    public Optional<Item> addQuantity(String userId, String itemId, AddQuantityRequest request) {
        return repository.findByIdAndUserId(itemId, userId)
                .map(item -> {
                    double added = request.quantity() != null ? request.quantity() : 0.0;
                    item.setCurrentQuantity(item.getCurrentQuantity() + added);
                    return repository.save(item);
                });
    }
}
