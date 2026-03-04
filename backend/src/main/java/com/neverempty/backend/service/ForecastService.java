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
                .map(item -> buildForecast(item, calculationDate))
                .toList();
        return new ForecastResponse(calculationDate, forecasts);
    }

    public Optional<ItemForecast> getItemForecast(String userId, String itemId, LocalDate calculationDate) {
        return itemRepository.findByIdAndUserId(itemId, userId)
                .map(item -> buildForecast(item, calculationDate));
    }

    public ItemForecast buildForecast(Item item, LocalDate calculationDate) {
        double monthlyRate = item.getMonthlyConsumptionRate() != null
                ? item.getMonthlyConsumptionRate()
                : 1.0;

        double dailyConsumption = monthlyRate / 30.0;

        int daysUntilDepletion;
        if (dailyConsumption <= 0) {
            daysUntilDepletion = Integer.MAX_VALUE;
        } else {
            daysUntilDepletion = (int) Math.ceil(item.getCurrentQuantity() / dailyConsumption);
        }

        LocalDate estimatedDepletionDate = daysUntilDepletion == Integer.MAX_VALUE
                ? calculationDate.plusYears(100)
                : calculationDate.plusDays(daysUntilDepletion);

        double percentRemaining = Math.min(100.0, item.getCurrentQuantity() / 100.0 * 100.0);

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
