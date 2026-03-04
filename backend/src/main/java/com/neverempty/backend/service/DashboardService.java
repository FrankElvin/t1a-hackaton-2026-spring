package com.neverempty.backend.service;

import com.neverempty.backend.dto.DashboardSummary;
import com.neverempty.backend.dto.ItemForecast;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final ForecastService forecastService;
    private final SettingsService settingsService;

    public DashboardSummary getDashboard(String userId) {
        var calculationDate = settingsService.getCalculationDate(userId);
        var forecastResponse = forecastService.getForecast(userId, calculationDate);
        var allForecasts = forecastResponse.items();

        int notifyDays = settingsService.getNotificationSettings(userId).getNotifyDaysBeforeDepletion();

        var criticalItems = allForecasts.stream()
                .filter(f -> f.daysUntilDepletion() <= notifyDays)
                .toList();

        var upcomingPurchases = allForecasts.stream()
                .filter(f -> f.daysUntilDepletion() > notifyDays && f.daysUntilDepletion() <= 30)
                .toList();

        return new DashboardSummary(calculationDate, criticalItems, upcomingPurchases, allForecasts);
    }

    public List<ItemForecast> getStockLevels(String userId) {
        var calculationDate = settingsService.getCalculationDate(userId);
        var forecastResponse = forecastService.getForecast(userId, calculationDate);
        return forecastResponse.items();
    }

    public List<ItemForecast> getUpcomingPurchases(String userId, int withinDays) {
        var calculationDate = settingsService.getCalculationDate(userId);
        var forecastResponse = forecastService.getForecast(userId, calculationDate);
        int notifyDays = settingsService.getNotificationSettings(userId).getNotifyDaysBeforeDepletion();

        return forecastResponse.items().stream()
                .filter(f -> f.daysUntilDepletion() <= withinDays && f.daysUntilDepletion() > notifyDays)
                .toList();
    }
}
