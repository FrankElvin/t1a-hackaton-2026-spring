package com.neverempty.backend.dto;

import com.neverempty.backend.model.enums.ItemCategory;

/**
 * Parsed product from receipt/email - not yet saved as Item.
 * Used in ImportBatch for user review flow.
 */
public record ParsedProductDto(
        int index,
        String name,
        double quantity,
        String unit,
        Double priceAmount,
        String priceCurrency,
        ItemCategory category,
        Double monthlyConsumptionRate
) {}
