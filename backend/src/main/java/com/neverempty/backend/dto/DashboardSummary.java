package com.neverempty.backend.dto;

import java.time.LocalDate;
import java.util.List;

public record DashboardSummary(
        LocalDate calculationDate,
        List<ItemForecast> criticalItems,
        List<ItemForecast> upcomingPurchases,
        List<ItemForecast> stockLevels
) {}
