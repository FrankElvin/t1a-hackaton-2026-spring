package com.neverempty.backend.dto;

import java.time.LocalDate;

public record ItemForecast(
        String itemId,
        String itemName,
        double currentQuantity,
        String unit,
        double estimatedDailyConsumption,
        LocalDate estimatedDepletionDate,
        int daysUntilDepletion,
        double percentRemaining,
        LocalDate calculationDate
) {}
