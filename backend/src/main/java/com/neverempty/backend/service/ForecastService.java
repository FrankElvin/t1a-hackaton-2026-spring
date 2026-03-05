package com.neverempty.backend.service;

import com.neverempty.backend.dto.ForecastResponse;
import com.neverempty.backend.dto.ItemForecast;
import com.neverempty.backend.model.Item;
import com.neverempty.backend.repository.ItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ForecastService {

    private final ItemRepository itemRepository;

    public ForecastResponse getForecast(String userId, LocalDate calculationDate) {
        var items = itemRepository.findByUserId(userId);
        var forecasts = items.stream()
                .filter(item -> item.getDaysToRestock() != null && item.getUsagePerDay() != null)
                .map(item -> buildForecast(item, calculationDate))
                .toList();
        return new ForecastResponse(calculationDate, forecasts);
    }

    public Optional<ItemForecast> getItemForecast(String userId, String itemId, LocalDate calculationDate) {
        return itemRepository.findByIdAndUserId(itemId, userId)
                .filter(item -> item.getDaysToRestock() != null && item.getUsagePerDay() != null)
                .map(item -> buildForecast(item, calculationDate));
    }

    /**
     * Builds a forecast for an item.
     * daysToRestock is the live counter decremented daily by DailyUpdateScheduler.
     * usagePerDay is the daily consumption rate.
     */
    public ItemForecast buildForecast(Item item, LocalDate calculationDate) {
        int daysUntilDepletion = item.getDaysToRestock() != null
                ? (int) Math.round(item.getDaysToRestock()) : 0;
        double dailyConsumption = item.getUsagePerDay() != null ? item.getUsagePerDay() : 0;

        LocalDate estimatedDepletionDate = calculationDate.plusDays(daysUntilDepletion);

        double percentRemaining = Math.min(100.0, daysUntilDepletion / 30.0 * 100.0);

        return new ItemForecast(
                item.getId(),
                item.getName(),
                item.getCurrentQuantity(),
                item.getUnit(),
                dailyConsumption,
                estimatedDepletionDate,
                daysUntilDepletion,
                percentRemaining,
                calculationDate
        );
    }
}
