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
                .filter(item -> item.getMonthlyConsumptionRate() != null && item.getMonthlyConsumptionRate() > 0)
                .map(item -> buildForecast(item, calculationDate))
                .toList();
        return new ForecastResponse(calculationDate, forecasts);
    }

    public Optional<ItemForecast> getItemForecast(String userId, String itemId, LocalDate calculationDate) {
        return itemRepository.findByIdAndUserId(itemId, userId)
                .filter(item -> item.getMonthlyConsumptionRate() != null && item.getMonthlyConsumptionRate() > 0)
                .map(item -> buildForecast(item, calculationDate));
    }

    public ItemForecast buildForecast(Item item, LocalDate calculationDate) {
        double monthlyRate = item.getMonthlyConsumptionRate();
        double dailyConsumption = monthlyRate / 30.0;

        // If lastBoughtDate is set, subtract consumed quantity since purchase
        double effectiveQuantity = item.getCurrentQuantity();
        if (item.getLastBoughtDate() != null && !item.getLastBoughtDate().isBlank()) {
            try {
                LocalDate purchaseDate = LocalDate.parse(item.getLastBoughtDate());
                long daysSincePurchase = java.time.temporal.ChronoUnit.DAYS.between(purchaseDate, calculationDate);
                if (daysSincePurchase > 0) {
                    effectiveQuantity = Math.max(0, item.getCurrentQuantity() - daysSincePurchase * dailyConsumption);
                }
            } catch (Exception ignored) {
                // malformed date — fall back to currentQuantity
            }
        }

        int daysUntilDepletion;
        if (dailyConsumption <= 0) {
            daysUntilDepletion = Integer.MAX_VALUE;
        } else {
            daysUntilDepletion = (int) Math.ceil(effectiveQuantity / dailyConsumption);
        }

        LocalDate estimatedDepletionDate = daysUntilDepletion == Integer.MAX_VALUE
                ? calculationDate.plusYears(100)
                : calculationDate.plusDays(daysUntilDepletion);

        // Percentage of a 30-day window remaining (≥30 days = 100%, 0 days = 0%)
        double percentRemaining = daysUntilDepletion == Integer.MAX_VALUE
                ? 100.0
                : Math.min(100.0, daysUntilDepletion / 30.0 * 100.0);

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
