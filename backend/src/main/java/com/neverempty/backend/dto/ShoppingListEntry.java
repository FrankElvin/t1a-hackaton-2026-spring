package com.neverempty.backend.dto;

import java.time.LocalDate;

public record ShoppingListEntry(
        String itemId,
        String itemName,
        double requiredQuantity,
        String unit,
        Double price,
        LocalDate estimatedDepletionDate,
        boolean urgent
) {}
