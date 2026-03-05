package com.neverempty.backend.service;

import com.neverempty.backend.dto.ShoppingList;
import com.neverempty.backend.dto.ShoppingListEntry;
import com.neverempty.backend.dto.ShoppingListsResponse;
import com.neverempty.backend.model.Store;
import com.neverempty.backend.model.UserSettings;
import com.neverempty.backend.repository.ItemRepository;
import com.neverempty.backend.repository.StoreRepository;
import com.neverempty.backend.repository.UserSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ShoppingListService {

    private final StoreRepository storeRepository;
    private final ItemRepository itemRepository;
    private final ForecastService forecastService;
    private final UserSettingsRepository userSettingsRepository;

    public ShoppingListsResponse getShoppingLists(String userId, LocalDate calculationDate) {
        var stores = storeRepository.findByUserId(userId);
        int notifyDaysBefore = getNotifyDaysBeforeDepletion(userId);

        var lists = stores.stream()
                .map(store -> buildShoppingList(userId, store, calculationDate, notifyDaysBefore))
                .toList();

        return new ShoppingListsResponse(calculationDate, lists);
    }

    public Optional<ShoppingList> getShoppingListByStore(String userId, String storeId, LocalDate calculationDate) {
        int notifyDaysBefore = getNotifyDaysBeforeDepletion(userId);

        return storeRepository.findByIdAndUserId(storeId, userId)
                .map(store -> buildShoppingList(userId, store, calculationDate, notifyDaysBefore));
    }

    private ShoppingList buildShoppingList(String userId, Store store, LocalDate calculationDate, int notifyDaysBefore) {
        LocalDate nextVisitDate;
        if (store.getLastVisitDate() != null && store.getVisitIntervalDays() != null) {
            nextVisitDate = store.getLastVisitDate().plusDays(store.getVisitIntervalDays());
        } else if (store.getVisitIntervalDays() != null) {
            nextVisitDate = calculationDate.plusDays(store.getVisitIntervalDays());
        } else {
            nextVisitDate = calculationDate.plusDays(7);
        }

        var items = itemRepository.findByUserIdAndStoreId(userId, store.getId());
        var entries = new ArrayList<ShoppingListEntry>();
        double totalCost = 0.0;

        for (var item : items) {
            if (item.getUsagePerDay() == null || item.getDaysToRestock() == null) continue;
            var forecast = forecastService.buildForecast(item, calculationDate);
            var depletionDate = forecast.estimatedDepletionDate();

            if (!depletionDate.isAfter(nextVisitDate)) {
                boolean urgent = forecast.daysUntilDepletion() < notifyDaysBefore;
                double requiredQuantity = Math.max(0, item.getCurrentQuantity());

                var entry = new ShoppingListEntry(
                        item.getId(),
                        item.getName(),
                        requiredQuantity,
                        item.getUnit(),
                        item.getPrice(),
                        depletionDate,
                        urgent
                );
                entries.add(entry);

                if (item.getPrice() != null) {
                    totalCost += item.getPrice();
                }
            }
        }

        return new ShoppingList(
                store.getId(),
                store.getName(),
                nextVisitDate,
                entries,
                totalCost
        );
    }

    private int getNotifyDaysBeforeDepletion(String userId) {
        return userSettingsRepository.findByUserId(userId)
                .map(settings -> settings.getNotification() != null
                        ? settings.getNotification().getNotifyDaysBeforeDepletion()
                        : 5)
                .orElse(5);
    }
}
