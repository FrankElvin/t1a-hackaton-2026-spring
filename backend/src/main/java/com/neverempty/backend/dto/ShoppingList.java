package com.neverempty.backend.dto;

import java.time.LocalDate;
import java.util.List;

public record ShoppingList(
        String storeId,
        String storeName,
        LocalDate nextVisitDate,
        List<ShoppingListEntry> entries,
        double totalEstimatedCost
) {}
